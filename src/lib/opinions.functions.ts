/**
 * Server functions for the Court Record (Supreme Court opinions) section.
 * Reads `opinion_record` in self_law (built by scripts/opinions-build.sql from
 * the dormant scotus_clean table — ~28.5k substantial public-domain SCOTUS
 * opinions, full text, cite + year extracted from the opening line).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function sb(): Promise<any> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase as any;
}

export type OpinionListItem = {
  slug: string;
  case_title: string;
  us_cite: string | null;
  year: number | null;
  cited_count: number;
};
export type Opinion = OpinionListItem & { decade: number | null; body_len: number; body_text: string };

export const OPINIONS_PAGE = 40;

// Filtered, paginated index. Default order is most-cited first (landmark cases).
export const getOpinionsIndex = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      q: z.string().optional(),
      decade: z.number().optional(),
      letter: z.string().optional(),
      page: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const c = await sb();
    const page = Math.max(0, data.page ?? 0);
    let q = c.from("opinion_record").select("slug,case_title,us_cite,year,cited_count", { count: "exact" });
    if (data.q && data.q.trim()) q = q.textSearch("title_tsv", data.q.trim(), { type: "websearch", config: "english" });
    if (data.decade != null) q = q.eq("decade", data.decade);
    if (data.letter) q = q.eq("first_letter", data.letter.toUpperCase());
    q = q.order("cited_count", { ascending: false }).range(page * OPINIONS_PAGE, page * OPINIONS_PAGE + OPINIONS_PAGE - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as OpinionListItem[], total: count ?? 0, page, pageSize: OPINIONS_PAGE };
  });

// One opinion + full body for the reader.
export const getOpinion = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const c = await sb();
    const { data: row, error } = await c
      .from("opinion_record")
      .select("slug,case_title,us_cite,year,decade,cited_count,body_len,body_text")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { opinion: (row ?? null) as Opinion | null };
  });

// All slugs for the sitemap (paged — PostgREST caps ~1000/req).
export const getOpinionSitemapSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const c = await sb();
  const all: string[] = [];
  const P = 1000;
  for (let off = 0; off < 60000; off += P) {
    const { data, error } = await c.from("opinion_record").select("slug").order("slug").range(off, off + P - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []).map((r: any) => r.slug as string);
    all.push(...batch);
    if (batch.length < P) break;
  }
  return { slugs: all };
});
