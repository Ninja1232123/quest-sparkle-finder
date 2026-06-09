/**
 * Court cases — CourtListener data via postgres_fdw + PostgREST.
 *
 * The local self_law database has a `cl` schema with foreign tables that
 * proxy into the courtlistener PostgreSQL database on the same server.
 * PostgREST exposes `cl` alongside `public`, so the corpus Supabase client
 * (which already talks to self_law PostgREST) can call cl.* RPC functions
 * without any extra connection or package.
 *
 * Run scripts/cl-grant-authenticator.sql and the two cl.* functions
 * (search_cases_by_cause, get_case_opinion) to enable this.
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
  cl_cluster_id: number | null;
  name: string;
  court: string | null;
  year: string;
  cite_count: number;
  outcome: string | null;
  snippet: string;
  url: string | null;
};

export type ClOpinion = {
  cl_cluster_id: number;
  case_name: string;
  court: string | null;
  date_filed: string | null;
  cite_count: number;
  outcome: string | null;
  cl_url: string;
  text: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

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

function identifierToCause(identifier: string): { causePrefix: string; label: string } | null {
  const usc = identifier.match(/\/usc\/title-(\d+)\/section-(\d+)/);
  if (usc) {
    return {
      causePrefix: `${usc[1]}:${usc[2]}`,
      label: `${usc[1]} U.S.C. § ${identifier.match(/\/section-([^/]+)$/)?.[1] ?? usc[2]}`,
    };
  }
  return null;
}

async function getCorpusClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

async function getCloudClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
  const key = process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Query the cl schema via PostgREST → FDW → courtlistener database.
async function queryLocalCases(causePrefix: string): Promise<ClCase[]> {
  try {
    const corpus = await getCorpusClient();
    const { data, error } = await (corpus as any)
      .schema("cl")
      .rpc("search_cases_by_cause", { cause_prefix: causePrefix, result_limit: 8 });
    if (error || !data?.length) return [];
    return (data as any[]).map((r) => ({
      cl_cluster_id: Number(r.cl_cluster_id),
      case_name: r.case_name || "Untitled",
      court: r.court || null,
      date_filed: r.date_filed ? String(r.date_filed).slice(0, 10) : null,
      cite_count: Number(r.cite_count),
      cl_url: `https://www.courtlistener.com/opinion/${r.cl_cluster_id}/${r.slug || ""}`,
      outcome: r.outcome || null,
    }));
  } catch {
    return [];
  }
}

function clHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const token = process.env.COURTLISTENER_API_TOKEN || process.env.COURTLISTENER_API_KEY;
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

      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await cloud
        .from("cl_section_cases")
        .select("cl_cluster_id, case_name, court, date_filed, cite_count, cl_url, outcome")
        .eq("identifier", identifier)
        .gt("fetched_at", cutoff)
        .order("cite_count", { ascending: false })
        .limit(8);

      if (cached && cached.length > 0) return { cases: cached as ClCase[] };

      let results: ClCase[] = await queryLocalCases(mapped.causePrefix);
      if (results.length === 0) results = await queryRestApiCases(mapped.label);

      if (results.length > 0) {
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
  if (statuteCitation) {
    const m = statuteCitation.match(/(\d+)\s*U\.?S\.?C\.?\s*[§\s]*(\d+)/i);
    if (m) {
      const rows = await queryLocalCases(`${m[1]}:${m[2]}`);
      if (rows.length > 0) {
        return {
          cases: rows.map((r) => ({
            cl_cluster_id: r.cl_cluster_id,
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
        cl_cluster_id: Number(r.cluster_id ?? r.id ?? 0) || null,
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

// ── Case reader ──────────────────────────────────────────────────────────────

// Fetch opinion text from CL REST API (local search_opinion table is empty).
async function fetchOpinionTextFromApi(clusterId: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://www.courtlistener.com/api/rest/v4/opinions/?cluster=${clusterId}&order_by=ordering_key`,
      { headers: clHeaders(), signal: AbortSignal.timeout(10000) },
    );
    if (!resp.ok) return "";
    const json = await resp.json();
    const opinions: any[] = json.results ?? [];
    if (!opinions.length) return "";
    const op = opinions.find((o: any) => o.plain_text?.trim() || o.html_with_citations?.trim())
      ?? opinions[0];
    const raw = (op.plain_text ?? "").trim() || (op.html_with_citations ?? "").trim();
    return raw.startsWith("<") ? stripHtml(raw) : raw;
  } catch {
    return "";
  }
}

// Full case fallback: fetch metadata + text from CL API when the local DB
// function fails (e.g. broken FDW column). Returns null only if CL API is
// unreachable or the cluster doesn't exist.
async function fetchCaseFromApi(clusterId: number): Promise<ClOpinion | null> {
  try {
    const [clusterResp, opinionsResp] = await Promise.all([
      fetch(
        `https://www.courtlistener.com/api/rest/v4/clusters/${clusterId}/`,
        { headers: clHeaders(), signal: AbortSignal.timeout(8000) },
      ),
      fetch(
        `https://www.courtlistener.com/api/rest/v4/opinions/?cluster=${clusterId}&order_by=ordering_key`,
        { headers: clHeaders(), signal: AbortSignal.timeout(8000) },
      ),
    ]);
    if (!clusterResp.ok) return null;
    const c = await clusterResp.json();

    let text = "";
    if (opinionsResp.ok) {
      const oj = await opinionsResp.json();
      const ops: any[] = oj.results ?? [];
      const op = ops.find((o: any) => o.plain_text?.trim() || o.html_with_citations?.trim()) ?? ops[0];
      if (op) {
        const raw = (op.plain_text ?? "").trim() || (op.html_with_citations ?? "").trim();
        text = raw.startsWith("<") ? stripHtml(raw) : raw;
      }
    }

    return {
      cl_cluster_id: clusterId,
      case_name: (c.case_name as string) || "Untitled",
      court: null, // court requires a separate docket fetch; omit for speed
      date_filed: c.date_filed ? String(c.date_filed).slice(0, 10) : null,
      cite_count: Number(c.citation_count ?? 0),
      outcome: null,
      cl_url: `https://www.courtlistener.com/opinion/${clusterId}/${c.slug || ""}`,
      text,
    };
  } catch {
    return null;
  }
}

export const fetchCaseOpinion = createServerFn({ method: "GET" })
  .inputValidator(z.object({ cluster_id: z.number().int().positive() }))
  .handler(async ({ data }): Promise<{ opinion: ClOpinion | null }> => {
    try {
      const corpus = await getCorpusClient();
      const { data: rows, error } = await (corpus as any)
        .schema("cl")
        .rpc("get_case_opinion", { p_cluster_id: data.cluster_id });

      // Local DB failed (broken FDW column, schema not accessible, etc.) —
      // fall back to CL REST API for both metadata and text.
      if (error || !rows?.length) {
        const opinion = await fetchCaseFromApi(data.cluster_id);
        return { opinion };
      }

      const r = rows[0] as any;
      let localText = (r.text_content as string | null)?.trim() ?? "";
      if (localText.startsWith("<")) localText = stripHtml(localText);
      const text = localText || await fetchOpinionTextFromApi(data.cluster_id);

      return {
        opinion: {
          cl_cluster_id: Number(r.cl_cluster_id),
          case_name: (r.case_name as string) || "Untitled",
          court: (r.court as string | null) || null,
          date_filed: r.date_filed ? String(r.date_filed).slice(0, 10) : null,
          cite_count: Number(r.cite_count),
          outcome: (r.outcome as string | null) || null,
          cl_url: `https://www.courtlistener.com/opinion/${data.cluster_id}/${r.slug || ""}`,
          text,
        },
      };
    } catch (e) {
      console.error("fetchCaseOpinion failed:", e);
      return { opinion: null };
    }
  });

export async function readCaseForJuri(
  clusterId: number,
): Promise<{ text: string; truncated: boolean; total_chars: number; error?: string }> {
  try {
    const corpus = await getCorpusClient();
    const { data: rows, error } = await (corpus as any)
      .schema("cl")
      .rpc("get_case_opinion", { p_cluster_id: clusterId });

    let full = "";

    if (error || !rows?.length) {
      // Local DB unavailable — fetch text via CL API directly.
      full = await fetchOpinionTextFromApi(clusterId);
    } else {
      const r = rows[0] as any;
      let localText = ((r.text_content as string | null) ?? "").trim();
      if (localText.startsWith("<")) localText = stripHtml(localText);
      full = localText || await fetchOpinionTextFromApi(clusterId);
    }

    if (!full) {
      return { text: "", truncated: false, total_chars: 0, error: "No opinion text available from local DB or CourtListener API" };
    }
    const CHUNK = 8000;
    return {
      text: full.slice(0, CHUNK),
      truncated: full.length > CHUNK,
      total_chars: full.length,
    };
  } catch {
    return { text: "", truncated: false, total_chars: 0, error: "Failed to read opinion" };
  }
}
