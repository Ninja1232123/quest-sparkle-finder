/**
 * Court cases — CourtListener integration.
 *
 * fetchSectionCases: given a corpus identifier, returns the top cases from
 * CourtListener that cite that statute section. Results are cached in
 * cl_section_cases (cloud Supabase, 7-day TTL) so cold-miss latency is
 * one-time-per-section. On cache hit, returns in <50ms.
 *
 * Set COURTLISTENER_API_TOKEN in Vercel env for higher rate limits.
 * Without it, anonymous access applies (~10 req/min per IP, sufficient
 * for the first-visit cold-miss pattern once the cache builds up).
 *
 * searchCasesForJuri: lightweight CourtListener search used by Juri's
 * agentic loop when the user asks about how courts have applied a law.
 * Returns metadata + text snippets (no full opinion reads — Juri uses
 * these to cite relevant cases; users click through to read the full text).
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
};

export type ClCaseResult = {
  name: string;
  court: string | null;
  year: string;
  cite_count: number;
  snippet: string;
  url: string | null;
};

// Map CourtListener court IDs to short display names for the panel.
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

// Convert a corpus section identifier to a CourtListener search query.
// Returns a quoted citation string, or null for sources with no obvious
// citation pattern (state statutes, IRM, etc.).
function identifierToCLQuery(identifier: string): string | null {
  // /usc/title-15/section-1692e → "15 U.S.C. § 1692e"
  const usc = identifier.match(/\/usc\/title-(\d+)\/section-([^/]+)$/);
  if (usc) return `"${usc[1]} U.S.C. § ${usc[2]}"`;

  // /us/cfr/t12/s226.1 → "12 C.F.R. § 226.1"
  const cfr = identifier.match(/\/us\/cfr\/t(\d+)\/s(?:§\s*)?([^/]+)$/);
  if (cfr) {
    const sec = cfr[2].replace(/^§\s*/, "").trim();
    return `"${cfr[1]} C.F.R. § ${sec}"`;
  }

  // /us/ucc/a2/s2-207 → "U.C.C. § 2-207"
  const ucc = identifier.match(/\/us\/ucc\/a\d+\/s([^/]+)$/);
  if (ucc) return `"U.C.C. § ${ucc[1]}"`;

  return null;
}

async function getCloudClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
  const key = process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (token) h.Authorization = `Token ${token}`;
  return h;
}

function parseClCase(r: any, identifier: string): ClCase | null {
  const id = r.cluster_id ?? r.id;
  if (!id) return null;
  return {
    cl_cluster_id: Number(id),
    case_name: r.caseName ?? r.case_name ?? "Untitled",
    court: r.court ?? null,
    date_filed: (r.dateFiled ?? r.date_filed ?? null),
    cite_count: Number(r.citeCount ?? r.cite_count ?? 0),
    cl_url: r.absolute_url
      ? `https://www.courtlistener.com${r.absolute_url}`
      : `https://www.courtlistener.com/opinion/${id}/`,
  };
}

// ── Public server function ───────────────────────────────────────────────────

export const fetchSectionCases = createServerFn({ method: "GET" })
  .validator(z.object({ identifier: z.string().max(300) }))
  .handler(async ({ data }): Promise<{ cases: ClCase[] }> => {
    const { identifier } = data;
    const query = identifierToCLQuery(identifier);
    if (!query) return { cases: [] };

    try {
      const cloud = await getCloudClient();
      if (!cloud) return { cases: [] };

      // Cache hit: return fresh rows (< 7 days) sorted by precedential weight.
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await cloud
        .from("cl_section_cases")
        .select("cl_cluster_id, case_name, court, date_filed, cite_count, cl_url")
        .eq("identifier", identifier)
        .gt("fetched_at", cutoff)
        .order("cite_count", { ascending: false })
        .limit(8);

      if (cached && cached.length > 0) return { cases: cached as ClCase[] };

      // Cache miss — query CourtListener.
      const params = new URLSearchParams({
        q: query,
        type: "o",
        order_by: "citeCount desc",
        stat_Precedential: "on",
      });
      const resp = await fetch(
        `https://www.courtlistener.com/api/rest/v4/search/?${params}`,
        { headers: clHeaders(), signal: AbortSignal.timeout(6000) },
      );
      if (!resp.ok) return { cases: [] };

      const json = await resp.json();
      const results: ClCase[] = (json.results ?? [])
        .slice(0, 8)
        .map((r: any) => parseClCase(r, identifier))
        .filter(Boolean) as ClCase[];

      if (results.length > 0) {
        const rows = results.map((c) => ({
          identifier,
          cl_cluster_id: c.cl_cluster_id,
          case_name: c.case_name,
          court: c.court,
          date_filed: c.date_filed,
          cite_count: c.cite_count,
          cl_url: c.cl_url,
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

// ── Used by Juri's agentic loop (imported in juri.functions.ts) ─────────────

export async function searchCasesForJuri(
  query: string,
  statuteCitation?: string,
): Promise<{ cases: ClCaseResult[] }> {
  try {
    const q = statuteCitation ? `"${statuteCitation}" ${query}` : query;
    const params = new URLSearchParams({
      q: q.slice(0, 300),
      type: "o",
      order_by: "citeCount desc",
      stat_Precedential: "on",
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
        snippet: (r.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 500),
        url: r.absolute_url
          ? `https://www.courtlistener.com${r.absolute_url}`
          : null,
      })),
    };
  } catch {
    return { cases: [] };
  }
}
