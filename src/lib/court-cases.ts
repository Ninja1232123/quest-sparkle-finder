/**
 * Court cases — local CourtListener DB integration.
 *
 * Queries the local `courtlistener` PostgreSQL database directly (same server
 * as self_law, owned by the `django` role, grants in cl-grant-authenticator.sql).
 * No REST API calls, no rate limits, and we get cluster_outcome (normalized
 * outcomes) for free — something CourtListener's public API doesn't surface.
 *
 * Statute → case link: search_docket.cause holds the PACER cause-of-action
 * code, which uses the format "{title}:{section} ACT NAME", e.g.
 *   "15:1692 FAIR DEBT COLLECTION PRACTICES ACT"
 *   "15:1681 CONSUMER CREDIT PROTECTION ACT"
 *   "42:1983 CIVIL RIGHTS"
 * We extract title + section from the corpus identifier and match cause with
 * ILIKE. For section-level granularity (1692e vs 1692g) the cause field
 * records the subchapter root (1692), so all subsections of an act share
 * one cause code — good enough for "cases under this statute" discovery.
 *
 * Results cached in cl_section_cases (cloud Supabase, 7-day TTL) so the
 * first visitor pays the query cost; everyone else hits the cache.
 *
 * Run scripts/cl-grant-authenticator.sql once to enable the grants.
 * Set CL_DB_URL in Vercel env: postgres://authenticator:{pass}@{host}:5432/courtlistener
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ClCase = {
  cl_cluster_id: number;
  case_name: string;
  court: string | null;
  date_filed: string | null;
  cite_count: number;
  cl_url: string;
  outcome: string | null;
};

export type ClCaseResult = {
  name: string;
  court: string | null;
  year: string;
  cite_count: number;
  outcome: string | null;
  snippet: string;
  url: string | null;
};

// Map CourtListener court IDs to short display names.
const COURT_SHORT: Record<string, string> = {
  scotus: "U.S. Sup. Ct.", ca1: "1st Cir.", ca2: "2nd Cir.", ca3: "3rd Cir.",
  ca4: "4th Cir.", ca5: "5th Cir.", ca6: "6th Cir.", ca7: "7th Cir.",
  ca8: "8th Cir.", ca9: "9th Cir.", ca10: "10th Cir.", ca11: "11th Cir.",
  cadc: "D.C. Cir.", cafc: "Fed. Cir.",
};
export function courtDisplay(court: string | null): string {
  if (!court) return "";
  return COURT_SHORT[court.toLowerCase()] ?? court.toUpperCase().slice(0, 18);
}

// Parse a corpus identifier into the PACER cause prefix and display label.
// Returns null for sources that don't map to federal causes (state, UCC, etc.)
function identifierToCause(identifier: string): { causePrefix: string; label: string } | null {
  // /usc/title-15/section-1692e → cause LIKE '15:1692%'
  const usc = identifier.match(/\/usc\/title-(\d+)\/section-(\d+)/);
  if (usc) {
    return {
      causePrefix: `${usc[1]}:${usc[2]}`,
      label: `${usc[1]} U.S.C. § ${identifier.match(/\/section-([^/]+)$/)?.[1] ?? usc[2]}`,
    };
  }
  // /us/cfr/t12/s226.1 — CFR sections appear in dockets by their enabling statute,
  // not by CFR cite, so we can't reliably map them here.
  return null;
}

// Direct connection to the local courtlistener DB.
// Falls back to the REST API if CL_DB_URL isn't set (dev without local DB).
async function getClDb() {
  const url = process.env.CL_DB_URL;
  if (!url) return null;
  const { default: postgres } = await import("postgres");
  return postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 5 });
}

async function getCloudClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
  const key = process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Query the local courtlistener DB for cases whose docket cause matches the
// statute. Returns top 8 by citation_count (precedential weight).
async function queryLocalCases(causePrefix: string): Promise<ClCase[]> {
  const db = await getClDb();
  if (!db) return [];
  try {
    const rows = await db`
      SELECT
        oc.id           AS cl_cluster_id,
        oc.case_name,
        d.court_id      AS court,
        oc.date_filed,
        oc.citation_count AS cite_count,
        oc.slug,
        co.outcome
      FROM search_docket d
      JOIN search_opinioncluster oc ON oc.docket_id = d.id
      LEFT JOIN cluster_outcome co ON co.cluster_id = oc.id
      WHERE d.cause ILIKE ${causePrefix + "%"}
        AND oc.precedential_status = 'Published'
        AND oc.citation_count > 0
      ORDER BY oc.citation_count DESC
      LIMIT 8
    `;
    await db.end();
    return rows.map((r: any) => ({
      cl_cluster_id: Number(r.cl_cluster_id),
      case_name: r.case_name || "Untitled",
      court: r.court || null,
      date_filed: r.date_filed ? String(r.date_filed).slice(0, 10) : null,
      cite_count: Number(r.cite_count),
      cl_url: `https://www.courtlistener.com/opinion/${r.cl_cluster_id}/${r.slug || ""}`,
      outcome: r.outcome || null,
    }));
  } catch (e) {
    console.error("courtlistener local query failed:", e);
    try { await db.end(); } catch {}
    return [];
  }
}

// Fallback: CourtListener REST API (used when CL_DB_URL not configured).
function clHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (token) h.Authorization = `Token ${token}`;
  return h;
}

async function queryRestApiCases(label: string): Promise<ClCase[]> {
  try {
    const params = new URLSearchParams({
      q: `"${label}"`, type: "o", order_by: "citeCount desc", stat_Precedential: "on",
    });
    const resp = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?${params}`,
      { headers: clHeaders(), signal: AbortSignal.timeout(6000) },
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.results ?? []).slice(0, 8).map((r: any) => ({
      cl_cluster_id: Number(r.cluster_id ?? r.id ?? 0),
      case_name: r.caseName ?? r.case_name ?? "Untitled",
      court: r.court ?? null,
      date_filed: (r.dateFiled ?? r.date_filed ?? null),
      cite_count: Number(r.citeCount ?? r.cite_count ?? 0),
      cl_url: r.absolute_url
        ? `https://www.courtlistener.com${r.absolute_url}`
        : `https://www.courtlistener.com/opinion/${r.cluster_id ?? r.id}/`,
      outcome: null,
    })).filter((c: ClCase) => c.cl_cluster_id > 0);
  } catch {
    return [];
  }
}

// ── Public server function ───────────────────────────────────────────────────

export const fetchSectionCases = createServerFn({ method: "GET" })
  .inputValidator(z.object({ identifier: z.string().max(300) }))
  .handler(async ({ data }): Promise<{ cases: ClCase[] }> => {
    const { identifier } = data;
    const mapped = identifierToCause(identifier);
    if (!mapped) return { cases: [] };

    try {
      const cloud = await getCloudClient();
      if (!cloud) return { cases: [] };

      // Cache hit: return fresh rows (< 7 days).
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await cloud
        .from("cl_section_cases")
        .select("cl_cluster_id, case_name, court, date_filed, cite_count, cl_url, outcome")
        .eq("identifier", identifier)
        .gt("fetched_at", cutoff)
        .order("cite_count", { ascending: false })
        .limit(8);

      if (cached && cached.length > 0) return { cases: cached as ClCase[] };

      // Cache miss — query local DB (preferred) or REST API fallback.
      const results = process.env.CL_DB_URL
        ? await queryLocalCases(mapped.causePrefix)
        : await queryRestApiCases(mapped.label);

      if (results.length > 0 && cloud) {
        const rows = results.map((c) => ({
          identifier,
          cl_cluster_id: c.cl_cluster_id,
          case_name: c.case_name,
          court: c.court,
          date_filed: c.date_filed,
          cite_count: c.cite_count,
          cl_url: c.cl_url,
          outcome: c.outcome,
          fetched_at: new Date().toISOString(),
        }));
        await cloud
          .from("cl_section_cases")
          .upsert(rows, { onConflict: "identifier,cl_cluster_id" });
      }

      return { cases: results };
    } catch {
      return { cases: [] };
    }
  });

// ── Used by Juri's agentic loop ──────────────────────────────────────────────

export async function searchCasesForJuri(
  query: string,
  statuteCitation?: string,
): Promise<{ cases: ClCaseResult[] }> {
  // Try local DB first if a statute citation is provided (parseable to cause prefix).
  if (statuteCitation && process.env.CL_DB_URL) {
    // Extract title:section from the citation string.
    const m = statuteCitation.match(/(\d+)\s*U\.?S\.?C\.?\s*[§\s]*(\d+)/i);
    if (m) {
      const rows = await queryLocalCases(`${m[1]}:${m[2]}`);
      if (rows.length > 0) {
        return {
          cases: rows.map((r) => ({
            name: r.case_name,
            court: courtDisplay(r.court),
            year: (r.date_filed ?? "").slice(0, 4),
            cite_count: r.cite_count,
            outcome: r.outcome,
            snippet: "",
            url: r.cl_url,
          })),
        };
      }
    }
  }

  // Fall back to REST API for free-text queries or when local DB isn't available.
  try {
    const q = statuteCitation ? `"${statuteCitation}" ${query}` : query;
    const params = new URLSearchParams({
      q: q.slice(0, 300), type: "o", order_by: "citeCount desc", stat_Precedential: "on",
    });
    const resp = await fetch(
      `https://www.courtlistener.com/api/rest/v4/search/?${params}`,
      { headers: clHeaders(), signal: AbortSignal.timeout(6000) },
    );
    if (!resp.ok) return { cases: [] };
    const json = await resp.json();
    return {
      cases: (json.results ?? []).slice(0, 8).map((r: any) => ({
        name: r.caseName ?? r.case_name ?? "Untitled",
        court: courtDisplay(r.court ?? null),
        year: (r.dateFiled ?? r.date_filed ?? "").slice(0, 4),
        cite_count: Number(r.citeCount ?? r.cite_count ?? 0),
        outcome: null,
        snippet: (r.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 500),
        url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : null,
      })),
    };
  } catch {
    return { cases: [] };
  }
}
