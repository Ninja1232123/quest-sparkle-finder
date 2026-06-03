/**
 * Server functions for the Court Outcomes pages.
 *
 * Read the pre-aggregated serving slice in self_law: `stat_page` (one row per
 * page slug + headline summary) and `stat_outcome` (long-format outcome→n).
 * Built by scripts/{state-outcome-classifier,outcome-cube,stat-pages-build}.sql
 * and moved into self_law by scripts/stat-pages-serve.sh.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// stat tables aren't in the generated Database type; use an untyped client.
async function sb(): Promise<any> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase as any;
}

export type StatPage = {
  slug: string;
  scope: string;
  court_id: string | null;
  court_name: string | null;
  family: string | null;
  nos_code: number | null;
  nos_label: string | null;
  total_cases: number;
  merits_cases: number;
  plaintiff_win: number;
  defendant_win: number;
  settled: number;
  dismissed: number;
  plaintiff_win_pct: number | null;
};

const SUMMARY =
  "slug,scope,court_id,court_name,family,nos_code,nos_label,total_cases,merits_cases,plaintiff_win,defendant_win,settled,dismissed,plaintiff_win_pct";

// All families, for the hub + family navigation.
export const getFamilyList = createServerFn({ method: "GET" }).handler(async () => {
  const c = await sb();
  const { data, error } = await c
    .from("stat_page")
    .select("slug,family,total_cases,merits_cases,plaintiff_win_pct")
    .eq("scope", "family_national")
    .order("total_cases", { ascending: false });
  if (error) throw new Error(error.message);
  return { families: (data ?? []) as Pick<StatPage, "slug" | "family" | "total_cases" | "merits_cases" | "plaintiff_win_pct">[] };
});

// One page (by slug) + its full outcome distribution.
export const getStatPage = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const c = await sb();
    const [{ data: page, error: e1 }, { data: outcomes, error: e2 }] = await Promise.all([
      c.from("stat_page").select(SUMMARY).eq("slug", data.slug).maybeSingle(),
      c.from("stat_outcome").select("outcome,n").eq("slug", data.slug).order("n", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { page: (page ?? null) as StatPage | null, outcomes: (outcomes ?? []) as { outcome: string; n: number }[] };
  });

// Case types within a family (the family landing list).
export const getCaseTypesInFamily = createServerFn({ method: "GET" })
  .inputValidator(z.object({ family: z.string() }))
  .handler(async ({ data }) => {
    const c = await sb();
    const { data: rows, error } = await c
      .from("stat_page")
      .select(SUMMARY)
      .eq("scope", "casetype_national")
      .eq("family", data.family)
      .order("total_cases", { ascending: false });
    if (error) throw new Error(error.message);
    return { caseTypes: (rows ?? []) as StatPage[] };
  });

// Per-court breakdown for one case type (the "where you file matters" table).
export const getCourtsForCaseType = createServerFn({ method: "GET" })
  .inputValidator(z.object({ nos_code: z.number() }))
  .handler(async ({ data }) => {
    const c = await sb();
    const { data: rows, error } = await c
      .from("stat_page")
      .select(SUMMARY)
      .eq("scope", "court_casetype")
      .eq("nos_code", data.nos_code)
      .order("total_cases", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { courts: (rows ?? []) as StatPage[] };
  });

// Every page slug, for the sitemap. PostgREST caps rows per request (~1000),
// so page through with .range() until drained (~7k slugs → ~8 requests).
export const getOutcomeSitemapSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const c = await sb();
  const all: { slug: string; scope: string }[] = [];
  const PAGE = 1000;
  for (let off = 0; off < 100000; off += PAGE) {
    const { data, error } = await c
      .from("stat_page")
      .select("slug,scope")
      .order("slug", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as { slug: string; scope: string }[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return { slugs: all };
});

// Case types within one court (the court landing list).
export const getCaseTypesInCourt = createServerFn({ method: "GET" })
  .inputValidator(z.object({ court_id: z.string() }))
  .handler(async ({ data }) => {
    const c = await sb();
    const { data: rows, error } = await c
      .from("stat_page")
      .select(SUMMARY)
      .eq("scope", "court_casetype")
      .eq("court_id", data.court_id)
      .order("total_cases", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return { caseTypes: (rows ?? []) as StatPage[] };
  });
