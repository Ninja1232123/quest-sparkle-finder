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

export type SiblingNav = {
  identifier: string;
  heading: string | null;
  section_label: string | null;
} | null;

export const getDocument = createServerFn({ method: "GET" })
  .inputValidator(z.object({ identifier: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    const { data: doc, error } = await supabaseAdmin
      .from("documents")
      .select("id, source_code, identifier, parent_label, section_label, heading, body_text, body_md, hierarchy, word_count, sort_key")
      .eq("identifier", data.identifier)
      .maybeSingle();
    if (error || !doc) {
      return {
        document: null as DocumentRow | null,
        citations: [] as DocCitationRow[],
        incoming: [] as IncomingCitation[],
        prev: null as SiblingNav,
        next: null as SiblingNav,
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
      prev,
      next,
      error: null as string | null,
    };
  });

// Detect common citation shapes and return a normalized identifier guess.
// Examples:
//   "42 USC 1983"        -> "usc/42/1983"
//   "42 U.S.C. § 1983"   -> "usc/42/1983"
//   "29 CFR 1910.95"     -> "cfr/29/1910.95"
//   "U.C.C. 2-207"       -> "ucc/2-207"
function detectCitation(raw: string): { source: string; identifier?: string; title?: string; section?: string } | null {
  const s = raw.replace(/§/g, " ").replace(/\s+/g, " ").trim();
  // Title-based: "<title> <code> <section>"
  const m1 = s.match(/^(\d+)\s*(u\.?\s*s\.?\s*c\.?|c\.?\s*f\.?\s*r\.?)\s*([\w.\-]+)$/i);
  if (m1) {
    const code = /c/i.test(m1[2]) && /f/i.test(m1[2]) ? "cfr" : "usc";
    return { source: code, title: m1[1], section: m1[3], identifier: `${code}/${m1[1]}/${m1[3]}` };
  }
  // UCC: "ucc 2-207" or "u.c.c. 2-207"
  const m2 = s.match(/^(u\.?\s*c\.?\s*c\.?)\s*([\w.\-]+)$/i);
  if (m2) return { source: "ucc", section: m2[2], identifier: `ucc/${m2[2]}` };
  return null;
}

function buildSnippet(body: string, terms: string[], len = 260): string {
  if (!body) return "";
  const lower = body.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  let start = 0;
  if (idx !== -1) start = Math.max(0, idx - 60);
  const slice = body.slice(start, start + len).replace(/\s+/g, " ").trim();
  const prefix = start > 0 ? "…" : "";
  // Highlight terms with <mark>; keep raw text safe by escaping first.
  const escaped = prefix + slice.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  let highlighted = escaped;
  for (const t of terms) {
    if (!t || t.length < 2) continue;
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    highlighted = highlighted.replace(re, "<mark>$1</mark>");
  }
  return highlighted;
}

export const searchDocuments = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    q: z.string().min(2).max(200),
    source: z.string().min(2).max(20).optional(),
  }))
  .handler(async ({ data }) => {
    const raw = data.q.trim();
    const terms = raw.split(/\s+/).filter((t) => t.length >= 2 && !/^(the|and|or|of|a|an|to|in|for|by|on|is)$/i.test(t));

    // 1) If the query looks like a citation, jump straight to it.
    const cite = detectCitation(raw);
    if (cite?.identifier) {
      const { data: direct } = await supabaseAdmin
        .from("documents")
        .select("identifier, source_code, parent_label, section_label, heading, body_text")
        .eq("identifier", cite.identifier)
        .maybeSingle();
      if (direct) {
        return {
          hits: [{
            identifier: direct.identifier,
            source_code: direct.source_code,
            parent_label: direct.parent_label,
            section_label: direct.section_label,
            heading: direct.heading,
            snippet: buildSnippet(direct.body_text ?? "", terms),
            exact: true,
          }],
          error: null,
        };
      }
    }

    // 2) Full-text search with prefix matching so partial words work.
    //    Convert "due process" -> "due:* & process:*"
    const tsQuery = terms.length
      ? terms.map((t) => `${t.replace(/[^\w]/g, "")}:*`).filter(Boolean).join(" & ")
      : raw;

    let query = supabaseAdmin
      .from("documents")
      .select("identifier, source_code, parent_label, section_label, heading, body_text")
      .textSearch("search_tsv", tsQuery, { config: "english" })
      .limit(40);
    if (data.source) query = query.eq("source_code", data.source);
    let { data: rows, error } = await query;

    // 3) Fallback: heading / section_label / identifier ILIKE for things the
    //    English dictionary stems away (numbers, acronyms, short tokens).
    if ((!rows || rows.length === 0) && !error) {
      const like = `%${raw.replace(/[%_]/g, "")}%`;
      let fb = supabaseAdmin
        .from("documents")
        .select("identifier, source_code, parent_label, section_label, heading, body_text")
        .or(`heading.ilike.${like},section_label.ilike.${like},identifier.ilike.${like}`)
        .limit(40);
      if (data.source) fb = fb.eq("source_code", data.source);
      const r2 = await fb;
      rows = r2.data ?? [];
      error = r2.error ?? null;
    }

    if (error) return { hits: [], error: error.message };

    // 4) Rank: heading match > section/identifier > body. Stable secondary by source order.
    const sourceWeight: Record<string, number> = { const: 0, usc: 1, cfr: 2, ucc: 3, tfm: 4, irm: 5 };
    const lowerTerms = terms.map((t) => t.toLowerCase());
    const scored = (rows ?? []).map((r) => {
      const heading = (r.heading ?? "").toLowerCase();
      const ident = (r.identifier ?? "").toLowerCase();
      const sect = (r.section_label ?? "").toLowerCase();
      let score = 0;
      for (const t of lowerTerms) {
        if (heading.includes(t)) score += 10;
        if (sect.includes(t) || ident.includes(t)) score += 6;
      }
      return { r, score };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (sourceWeight[a.r.source_code] ?? 99) - (sourceWeight[b.r.source_code] ?? 99);
    });

    const hits = scored.map(({ r }) => ({
      identifier: r.identifier,
      source_code: r.source_code,
      parent_label: r.parent_label,
      section_label: r.section_label,
      heading: r.heading,
      snippet: buildSnippet(r.body_text ?? "", terms),
      exact: false,
    }));
    return { hits, error: null };
  });
