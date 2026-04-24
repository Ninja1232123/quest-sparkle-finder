import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UscSectionRow = {
  id: string;
  identifier: string;
  title_num: number;
  chapter: string | null;
  section_num: string;
  heading: string | null;
  body_text: string | null;
};

export type UscCitationRow = {
  to_identifier: string;
  to_section_id: string | null;
  context_snippet: string | null;
  target_heading?: string | null;
};

export const listUscTitles = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("usc_sections")
    .select("title_num")
    .order("title_num");
  if (error) return { titles: [] as number[], error: error.message };
  const titles = Array.from(new Set((data ?? []).map((r) => r.title_num)));
  return { titles, error: null as string | null };
});

export const listUscSections = createServerFn({ method: "GET" })
  .inputValidator(z.object({ titleNum: z.number().int().min(1).max(54) }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("usc_sections")
      .select("id, identifier, title_num, chapter, section_num, heading")
      .eq("title_num", data.titleNum)
      .order("identifier");
    if (error) return { sections: [], error: error.message };
    return { sections: (rows ?? []) as Omit<UscSectionRow, "body_text">[], error: null };
  });

export const getUscSection = createServerFn({ method: "GET" })
  .inputValidator(z.object({ identifier: z.string().min(3).max(200) }))
  .handler(async ({ data }) => {
    const { data: section, error } = await supabaseAdmin
      .from("usc_sections")
      .select("id, identifier, title_num, chapter, section_num, heading, body_text")
      .eq("identifier", data.identifier)
      .maybeSingle();
    if (error || !section) {
      return { section: null, citations: [], error: error?.message ?? "Not found" };
    }
    const { data: cites } = await supabaseAdmin
      .from("usc_citations")
      .select("to_identifier, to_section_id, context_snippet")
      .eq("from_section_id", section.id);

    // Resolve target headings for internal cites
    const targetIds = (cites ?? []).map((c) => c.to_section_id).filter(Boolean) as string[];
    let headingMap = new Map<string, string>();
    if (targetIds.length > 0) {
      const { data: targets } = await supabaseAdmin
        .from("usc_sections")
        .select("id, heading")
        .in("id", targetIds);
      headingMap = new Map((targets ?? []).map((t) => [t.id, t.heading ?? ""]));
    }

    const citations: UscCitationRow[] = (cites ?? []).map((c) => ({
      to_identifier: c.to_identifier,
      to_section_id: c.to_section_id,
      context_snippet: c.context_snippet,
      target_heading: c.to_section_id ? headingMap.get(c.to_section_id) ?? null : null,
    }));

    return { section: section as UscSectionRow, citations, error: null };
  });

export const searchUsc = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().min(2).max(200) }))
  .handler(async ({ data }) => {
    // Use websearch_to_tsquery via RPC-style raw SQL through rpc isn't set up;
    // use plain ilike fallback combined with tsv via textSearch.
    const { data: rows, error } = await supabaseAdmin
      .from("usc_sections")
      .select("id, identifier, title_num, section_num, heading, body_text")
      .textSearch("search_tsv", data.q, { type: "websearch", config: "english" })
      .limit(25);
    if (error) return { hits: [], error: error.message };
    const hits = (rows ?? []).map((r) => ({
      identifier: r.identifier,
      title_num: r.title_num,
      section_num: r.section_num,
      heading: r.heading,
      snippet: (r.body_text ?? "").slice(0, 220),
    }));
    return { hits, error: null };
  });