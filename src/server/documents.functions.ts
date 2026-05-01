import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type DocumentRow = {
  id: string;
  source_code: string;
  identifier: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  body_text: string | null;
  body_md: string | null;
  hierarchy: Json | null;
  word_count: number | null;
};

export type DocCitationRow = {
  to_identifier: string;
  to_document_id: string | null;
  target_heading: string | null;
  target_source: string | null;
  target_section_label: string | null;
};

export type SourceSummary = {
  code: string;
  name: string;
  count: number;
};

const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

export const listSources = createServerFn({ method: "GET" }).handler(async () => {
  // Pull the distinct source codes, then count each in parallel using head+exact-count
  // (avoids loading every row's source_code just to tally).
  const codes = ["const", "usc", "cfr", "ucc", "tfm", "irm"];
  const counts = await Promise.all(
    codes.map(async (code) => {
      const { count } = await supabaseAdmin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("source_code", code);
      return { code, count: count ?? 0 };
    }),
  );
  const sources: SourceSummary[] = counts
    .filter((c) => c.count > 0)
    .map(({ code, count }) => ({ code, count, name: SOURCE_NAMES[code] ?? code.toUpperCase() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { sources, error: null };
});

export const listDocumentsBySource = createServerFn({ method: "GET" })
  .inputValidator(z.object({ source: z.string().min(2).max(20), limit: z.number().int().min(1).max(2000).optional() }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("documents")
      .select("id, identifier, source_code, parent_label, section_label, heading, sort_key")
      .eq("source_code", data.source)
      .order("sort_key", { ascending: true })
      .limit(data.limit ?? 1500);
    if (error) return { documents: [], error: error.message };
    return { documents: rows ?? [], error: null };
  });

export type IncomingCitation = {
  identifier: string;
  heading: string | null;
  source: string;
  section_label: string | null;
};

export const getDocument = createServerFn({ method: "GET" })
  .inputValidator(z.object({ identifier: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    const { data: doc, error } = await supabaseAdmin
      .from("documents")
      .select("id, source_code, identifier, parent_label, section_label, heading, body_text, body_md, hierarchy, word_count")
      .eq("identifier", data.identifier)
      .maybeSingle();
    if (error || !doc) {
      return {
        document: null as DocumentRow | null,
        citations: [] as DocCitationRow[],
        incoming: [] as IncomingCitation[],
        error: error?.message ?? "Not found",
      };
    }

    const { data: outgoing } = await supabaseAdmin
      .from("doc_citations")
      .select("to_identifier, to_document_id")
      .eq("from_document_id", doc.id);

    const targetIds = (outgoing ?? []).map((c) => c.to_document_id).filter(Boolean) as string[];
    let targetMap = new Map<string, { heading: string | null; source: string; label: string | null }>();
    if (targetIds.length > 0) {
      const { data: targets } = await supabaseAdmin
        .from("documents")
        .select("id, heading, source_code, section_label")
        .in("id", targetIds);
      targetMap = new Map((targets ?? []).map((t) => [t.id, { heading: t.heading, source: t.source_code, label: t.section_label }]));
    }
    const citations: DocCitationRow[] = (outgoing ?? []).map((c) => {
      const t = c.to_document_id ? targetMap.get(c.to_document_id) : null;
      return {
        to_identifier: c.to_identifier,
        to_document_id: c.to_document_id,
        target_heading: t?.heading ?? null,
        target_source: t?.source ?? null,
        target_section_label: t?.label ?? null,
      };
    });

    // Incoming citations (other docs that cite this one)
    const { data: incomingRaw } = await supabaseAdmin
      .from("doc_citations")
      .select("from_document_id")
      .eq("to_document_id", doc.id)
      .limit(50);
    const fromIds = (incomingRaw ?? []).map((r) => r.from_document_id);
    let incoming: IncomingCitation[] = [];
    if (fromIds.length > 0) {
      const { data: fromDocs } = await supabaseAdmin
        .from("documents")
        .select("identifier, heading, source_code, section_label")
        .in("id", fromIds);
      incoming = (fromDocs ?? []).map((d) => ({
        identifier: d.identifier,
        heading: d.heading,
        source: d.source_code,
        section_label: d.section_label,
      }));
    }

    return {
      document: doc as DocumentRow,
      citations,
      incoming,
      error: null as string | null,
    };
  });

export const searchDocuments = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    q: z.string().min(2).max(200),
    source: z.string().min(2).max(20).optional(),
  }))
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("documents")
      .select("identifier, source_code, parent_label, section_label, heading, body_text")
      .textSearch("search_tsv", data.q, { type: "websearch", config: "english" })
      .limit(40);
    if (data.source) query = query.eq("source_code", data.source);
    const { data: rows, error } = await query;
    if (error) return { hits: [], error: error.message };
    const hits = (rows ?? []).map((r) => ({
      identifier: r.identifier,
      source_code: r.source_code,
      parent_label: r.parent_label,
      section_label: r.section_label,
      heading: r.heading,
      snippet: (r.body_text ?? "").slice(0, 240),
    }));
    return { hits, error: null };
  });
