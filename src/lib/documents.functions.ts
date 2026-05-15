import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateQueryEmbedding } from "@/lib/embeddings.functions";

// Queries that look like natural-language questions get the hybrid FTS + semantic path.
// Short keyword searches stay on FTS-only (faster, no embedding round-trip).
function isSemanticQuery(q: string): boolean {
  const words = q.trim().split(/\s+/);
  if (words.length >= 4) return true;
  if (/^(what|when|how|can|does|do|is|are|who|where|why|which|define|explain)\b/i.test(q)) return true;
  return false;
}

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
  .inputValidator(z.object({
    source: z.string().min(2).max(20),
    parent_label: z.string().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(5000).optional(),
  }))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("documents")
      .select("id, identifier, source_code, parent_label, section_label, heading, sort_key, body_text")
      .eq("source_code", data.source)
      .order("sort_key", { ascending: true })
      .limit(data.limit ?? 1500);
    if (data.parent_label) q = q.eq("parent_label", data.parent_label);
    const { data: rows, error } = await q;
    if (error) return { documents: [], error: error.message };
    // Derive a short preview from body_text so weak headings (numeric-only,
    // "Reserved", etc.) still give the user something meaningful to scan.
    const documents = (rows ?? []).map((r) => {
      const body = (r.body_text ?? "").replace(/\s+/g, " ").trim();
      const preview = body.slice(0, 140);
      // strip body_text from payload to keep it light
      const { body_text: _omit, ...rest } = r as Record<string, unknown> & { body_text?: string };
      return { ...rest, preview };
    });
    return { documents, error: null };
  });

export type SourceTocNode = {
  title_group: string;
  parts: { label: string; count: number; parent_label: string }[];
  total: number;
};

export const getSourceTOC = createServerFn({ method: "GET" })
  .inputValidator(z.object({ source: z.string().min(2).max(20) }))
  .handler(async ({ data }) => {
    // PostgREST caps result rows (typically at 1000) regardless of the RPC's
    // own ORDER BY. Page through with .range() until we drain the function.
    const PAGE = 1000;
    const all: { title_group: string; part_group: string | null; doc_count: number }[] = [];
    for (let offset = 0; offset < 100000; offset += PAGE) {
      const { data: rows, error } = await supabaseAdmin
        .rpc("source_toc", { p_source: data.source })
        .range(offset, offset + PAGE - 1);
      if (error) return { toc: [] as SourceTocNode[], error: error.message };
      const batch = (rows ?? []) as typeof all;
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    const map = new Map<string, SourceTocNode>();
    for (const r of all) {
      const key = r.title_group ?? "Other";
      let node = map.get(key);
      if (!node) {
        node = { title_group: key, parts: [], total: 0 };
        map.set(key, node);
      }
      const partLabel = r.part_group ?? "—";
      const parent_label = r.part_group ? `${key} · ${r.part_group}` : key;
      node.parts.push({ label: partLabel, count: Number(r.doc_count), parent_label });
      node.total += Number(r.doc_count);
    }
    // Sort numerically when possible
    const numKey = (s: string) => {
      const m = s.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 9999;
    };
    const toc = Array.from(map.values()).sort((a, b) => numKey(a.title_group) - numKey(b.title_group) || a.title_group.localeCompare(b.title_group));
    for (const n of toc) {
      n.parts.sort((a, b) => numKey(a.label) - numKey(b.label) || a.label.localeCompare(b.label));
    }
    return { toc, error: null };
  });

// Fire-and-forget: log a search event. Never blocks user-facing flow on failure.
export const logSearchEvent = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    q: z.string().min(1).max(200),
    source: z.string().min(2).max(20).optional(),
    hit_count: z.number().int().min(0).max(10000),
    exact_hit: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const q_normalized = data.q.toLowerCase().replace(/\s+/g, " ").trim();
    await supabaseAdmin.from("search_events").insert({
      q: data.q,
      q_normalized,
      source_filter: data.source ?? null,
      hit_count: data.hit_count,
      exact_hit: !!data.exact_hit,
    });
    return { ok: true };
  });

export const bumpDocView = createServerFn({ method: "POST" })
  .inputValidator(z.object({ identifier: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    await supabaseAdmin.rpc("bump_doc_view", { p_identifier: data.identifier });
    return { ok: true };
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

    // Prev / next sibling within the same source + parent_label, by sort_key.
    let prev: SiblingNav = null;
    let next: SiblingNav = null;
    if (doc.sort_key) {
      const baseSel = "identifier, heading, section_label, sort_key";
      const prevQ = supabaseAdmin
        .from("documents")
        .select(baseSel)
        .eq("source_code", doc.source_code)
        .lt("sort_key", doc.sort_key)
        .order("sort_key", { ascending: false })
        .limit(1);
      const nextQ = supabaseAdmin
        .from("documents")
        .select(baseSel)
        .eq("source_code", doc.source_code)
        .gt("sort_key", doc.sort_key)
        .order("sort_key", { ascending: true })
        .limit(1);
      const applyParent = <T extends { eq: (col: string, v: string) => T; is: (col: string, v: null) => T }>(q: T) =>
        doc.parent_label ? q.eq("parent_label", doc.parent_label) : q.is("parent_label", null);
      const [prevR, nextR] = await Promise.all([applyParent(prevQ), applyParent(nextQ)]);
      const p = prevR.data?.[0];
      const n = nextR.data?.[0];
      if (p) prev = { identifier: p.identifier, heading: p.heading, section_label: p.section_label };
      if (n) next = { identifier: n.identifier, heading: n.heading, section_label: n.section_label };
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

// Minimal snippet builder used only for the citation fast-path hit where ts_headline
// is not available (no tsquery object at that point).
function buildSnippet(body: string, terms: string[], len = 260): string {
  if (!body) return "";
  const lower = body.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  const start = idx !== -1 ? Math.max(0, idx - 60) : 0;
  const slice = body.slice(start, start + len).replace(/\s+/g, " ").trim();
  const prefix = start > 0 ? "…" : "";
  const escaped = prefix + slice.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  let out = escaped;
  for (const t of terms) {
    if (!t || t.length < 2) continue;
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

export const searchDocuments = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    q: z.string().min(2).max(200),
    source: z.string().min(2).max(20).optional(),
  }))
  .handler(async ({ data }) => {
    const raw = data.q.trim();
    // Terms are only needed for the citation fast-path snippet builder.
    const terms = raw.replace(/["()\-]/g, " ").split(/\s+/).filter((t) => t.length >= 2 && !/^(the|and|or|of|a|an|to|in|for|by|on|is)$/i.test(t));

    // 1) If the query looks like a citation, jump straight to it.
    const cite = detectCitation(raw);
    if (cite?.identifier) {
      const { data: direct } = await supabaseAdmin
        .from("documents")
        .select("identifier, source_code, parent_label, section_label, heading, body_text")
        .eq("identifier", cite.identifier)
        .maybeSingle();
      if (direct) {
        supabaseAdmin.from("search_events").insert({
          q: raw, q_normalized: raw.toLowerCase().replace(/\s+/g, " ").trim(),
          source_filter: data.source ?? null, hit_count: 1, exact_hit: true,
        }).then(() => {}, () => {});
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

    type SearchRow = {
      identifier: string; source_code: string; parent_label: string | null;
      section_label: string | null; heading: string | null; snippet: string | null; rank: number;
    };

    // 2) Choose search path based on query shape.
    //    Long / question-like queries → hybrid (FTS + semantic via pgvector).
    //    Short keyword queries → FTS-only (faster, no embedding round-trip).
    let rows: SearchRow[] | null = null;
    let usedSemantic = false;
    let usedTrgm = false;

    if (isSemanticQuery(raw)) {
      // Generate query embedding (returns null if no API key or on error — safe fallback).
      const embedding = await generateQueryEmbedding(raw);
      if (embedding) {
        usedSemantic = true;
        const { data: hybridRows, error: hybridError } = await (supabaseAdmin.rpc as unknown as (
          fn: string, args: Record<string, unknown>,
        ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>) (
          "search_hybrid", {
            p_query_text: raw,
            p_query_embedding: embedding as unknown as string,
            p_source: data.source ?? null,
            p_limit: 20,
          });
        if (!hybridError) rows = hybridRows ?? [];
      }
    }

    // Fall through to FTS if semantic was skipped or returned nothing.
    if (!rows || rows.length === 0) {
      usedSemantic = false;
      const { data: ftsRows, error: ftsError } = await (supabaseAdmin.rpc as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>) (
        "search_documents_fts", {
          p_query: raw,
          p_source: data.source ?? null,
          p_limit: 40,
        });
      if (ftsError) return { hits: [], error: ftsError.message };
      rows = ftsRows ?? [];
    }

    // 3) Fallback: trigram similarity when FTS returns nothing (typos, acronyms,
    //    short numeric tokens that the English stemmer doesn't index).
    if (!rows || rows.length === 0) {
      const { data: trgmRows } = await (supabaseAdmin.rpc as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>) (
        "search_documents_trgm", {
          p_query: raw,
          p_source: data.source ?? null,
          p_limit: 20,
        });
      rows = trgmRows ?? [];
      if (rows.length > 0) usedTrgm = true;
    }

    const hits = (rows ?? []).map((r) => ({
      identifier: r.identifier,
      source_code: r.source_code,
      parent_label: r.parent_label,
      section_label: r.section_label,
      heading: r.heading,
      snippet: r.snippet ?? "",
      exact: false,
      semantic: usedSemantic,
      trgm: usedTrgm,
    }));

    supabaseAdmin.from("search_events").insert({
      q: raw, q_normalized: raw.toLowerCase().replace(/\s+/g, " ").trim(),
      source_filter: data.source ?? null, hit_count: hits.length, exact_hit: false,
    }).then(() => {}, () => {});
    return { hits, error: null };
  });
