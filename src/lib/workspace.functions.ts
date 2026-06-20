// Workspace server functions — kept thin and backend-agnostic on purpose.
// All persistence goes through these fns; swap the storage layer by rewriting
// this file + the chat route's tool handlers.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as corpus } from "@/integrations/supabase/client";
import { z } from "zod";

// Two backends: `context.supabase` is the CLOUD auth project (workspace_* tables,
// RLS-scoped to the user). `corpus` is the LOCAL self_law backend (read-only
// publishable key) holding the legal corpus — documents, opinions, etc. Corpus
// reads MUST go through `corpus`; the cloud project has no corpus data.

const ThreadIdInput = z.object({ threadId: z.string().uuid() });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workspace_threads")
      .select("id,title,summary,last_message_at,created_at")
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspace_threads")
      .insert({ user_id: context.userId, title: data.title ?? "New session" })
      .select("id,title,last_message_at,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid(), title: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_threads")
      .update({ title: data.title })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_threads")
      .delete()
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: thread, error: tErr } = await context.supabase
      .from("workspace_threads")
      .select("id,title,summary,created_at,last_message_at")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found");
    const { data: rows, error } = await context.supabase
      .from("workspace_messages")
      .select("id,role,parts,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { thread, messages: rows ?? [] };
  });

export const listThreadDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_documents")
      .select("id,kind,title,created_at,updated_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspace_documents")
      .select("id,kind,title,body_md,citations,thread_id,created_at,updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Document not found");
    return row;
  });

export const seedThreadFromHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().max(200).optional(),
      messages: z.array(z.unknown()).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("workspace_threads")
      .insert({
        user_id: context.userId,
        title: data.title ?? "Continued from chat",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.messages.length > 0) {
      const rows = data.messages.map((m) => {
        const msg = m as { role?: string; parts?: unknown[]; content?: string };
        return {
          thread_id: thread.id,
          user_id: context.userId,
          role: msg.role ?? "user",
          parts: msg.parts ?? (msg.content ? [{ type: "text", text: msg.content }] : []),
        };
      });
      const { error: insErr } = await context.supabase.from("workspace_messages").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { threadId: thread.id };
  });

// ── Session draft (one per thread) ──────────────────────────────────────────
// One "draft" workspace_document per thread, kind='draft'. The editor owns it.
// Autosave upserts; on first save it gets created. Other generated artifacts
// (motions, etc.) keep using kind='memo' / 'motion' so they show separately.

export const getSessionDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspace_documents")
      .select("id,title,body_md,updated_at")
      .eq("thread_id", data.threadId)
      .eq("kind", "draft")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

// The model's rolling scratchpad — surfaced to the user so they can read and
// edit what the assistant is carrying forward as long-term memory.
export const getScratchpad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspace_threads")
      .select("scratchpad")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { scratchpad: (row as { scratchpad?: string | null } | null)?.scratchpad ?? "" };
  });

export const setScratchpad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ threadId: z.string().uuid(), content: z.string().max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_threads")
      .update({ scratchpad: data.content })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSessionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      title: z.string().min(1).max(200),
      bodyMd: z.string().max(500_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("workspace_documents")
      .select("id")
      .eq("thread_id", data.threadId)
      .eq("kind", "draft")
      .maybeSingle();
    if (existing?.id) {
      const { error } = await context.supabase
        .from("workspace_documents")
        .update({ title: data.title, body_md: data.bodyMd })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, updated_at: new Date().toISOString() };
    }
    const { data: row, error } = await context.supabase
      .from("workspace_documents")
      .insert({
        thread_id: data.threadId,
        user_id: context.userId,
        kind: "draft",
        title: data.title,
        body_md: data.bodyMd,
      })
      .select("id,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ── Corpus search (wraps existing FTS RPC, scoped to logged-in user) ────────
type SearchRow = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string | null;
  rank: number;
};

export const searchCorpus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().min(2).max(200),
      source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().nullable(),
      limit: z.number().int().min(1).max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await (corpus.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>)(
      "search_documents_fts",
      { p_query: data.q, p_source: data.source ?? null, p_limit: data.limit ?? 12 },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      identifier: r.identifier,
      source: r.source_code,
      heading: r.heading ?? "",
      sectionLabel: r.section_label ?? "",
      parentLabel: r.parent_label ?? "",
      snippet: (r.snippet ?? "").replace(/<\/?mark>/g, ""),
    }));
  });

// ── Case-law search (SCOTUS + state supreme courts, LOCAL corpus) ───────────
export type CaseHit = {
  id: string;            // 'scotus:<slug>' | 'state:<uuid>'
  court: string;
  title: string;
  citation: string;
  year: number | null;
  url: string | null;
};

export const searchCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      q: z.string().min(2).max(200),
      jurisdiction: z.string().max(40).optional().nullable(),
      limit: z.number().int().min(1).max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 12;
    const j = (data.jurisdiction ?? "").trim().toLowerCase();
    const wantScotus = j === "" || j === "scotus" || j === "us" || j === "supreme";
    const wantState = j === "" || j === "state" || !wantScotus;
    const out: CaseHit[] = [];
    // opinion_record / state_supreme_opinions aren't in the generated Database
    // types, so use an untyped view of the corpus client for these reads.
    const db = corpus as unknown as { from: (t: string) => any };
    if (wantScotus) {
      const { data: rows } = await db
        .from("opinion_record")
        .select("slug,case_title,us_cite,year,cited_count")
        .textSearch("body_tsv", data.q, { type: "websearch", config: "english" })
        .order("cited_count", { ascending: false })
        .limit(limit);
      for (const r of (rows ?? []) as Array<{ slug: string; case_title: string; us_cite: string | null; year: number | null }>) {
        out.push({ id: `scotus:${r.slug}`, court: "U.S. Supreme Court", title: r.case_title, citation: r.us_cite ?? "", year: r.year, url: `/record/${r.slug}` });
      }
    }
    if (wantState) {
      let query = db
        .from("state_supreme_opinions")
        .select("id,title,citation,state,issuer,decided_at")
        .textSearch("body_tsv", data.q, { type: "websearch", config: "english" });
      const stateName = j && !["", "state", "scotus", "us", "supreme"].includes(j) ? j : null;
      if (stateName) query = query.eq("state", stateName);
      const { data: rows } = await query.limit(limit);
      for (const r of (rows ?? []) as Array<{ id: string; title: string; citation: string | null; state: string; issuer: string | null; decided_at: string | null }>) {
        out.push({ id: `state:${r.id}`, court: r.issuer ?? `${r.state} Supreme Court`, title: r.title, citation: r.citation ?? "", year: r.decided_at ? new Date(r.decided_at).getFullYear() : null, url: null });
      }
    }
    return out;
  });

// ── Full corpus document (for the in-workspace reader / shared focus) ───────
// Fetches the full text of one statute/reg (by identifier, e.g. "usc/42/1983")
// or one opinion (by a searchCases id, "scotus:<slug>" | "state:<uuid>") from the
// LOCAL corpus. The viewer shows this and the same `ref` is sent to the chat
// endpoint so the model reads exactly what the user is reading.
export type CorpusDoc = {
  ref: string;
  identifier: string;
  citation: string;
  heading: string;
  court: string | null;
  body: string;
};

export const getCorpusDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ref: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }): Promise<CorpusDoc> => {
    const ref = data.ref.trim();
    const db = corpus as unknown as { from: (t: string) => any };

    if (ref.startsWith("scotus:")) {
      const slug = ref.slice("scotus:".length);
      const { data: row, error } = await db
        .from("opinion_record").select("slug,case_title,us_cite,year,body_text").eq("slug", slug).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Opinion not found");
      return {
        ref, identifier: `record/${row.slug}`, citation: row.us_cite ?? row.case_title,
        heading: row.case_title, court: "U.S. Supreme Court", body: (row.body_text ?? "").slice(0, 24000),
      };
    }
    if (ref.startsWith("state:")) {
      const id = ref.slice("state:".length);
      const { data: row, error } = await db
        .from("state_supreme_opinions").select("id,title,citation,state,issuer,body_text").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Opinion not found");
      return {
        ref, identifier: `state/${row.id}`, citation: row.citation ?? row.title,
        heading: row.title, court: row.issuer ?? `${row.state} Supreme Court`, body: (row.body_text ?? "").slice(0, 24000),
      };
    }
    // Statute / regulation / constitution by identifier.
    const { data: row, error } = await db
      .from("documents").select("identifier,source_code,section_label,heading,body_text").eq("identifier", ref).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Document not found");
    return {
      ref, identifier: row.identifier, citation: row.section_label ?? row.identifier,
      heading: row.heading ?? "", court: null, body: (row.body_text ?? "").slice(0, 24000),
    };
  });

// ── Case Board (per-thread stacks the user curates) ────────────────────────
const StanceEnum = z.enum(["support", "adverse", "neutral"]);
const KindEnum = z.enum(["authority", "question", "note"]);

export const listCaseItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_case_items")
      .select("id,kind,stance,identifier,citation,heading,pin_cite,quote,user_note,order_index,created_at")
      .eq("thread_id", data.threadId)
      .order("kind", { ascending: true })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      threadId: z.string().uuid(),
      kind: KindEnum,
      stance: StanceEnum.nullable().optional(),
      identifier: z.string().max(200).nullable().optional(),
      citation: z.string().max(300).nullable().optional(),
      heading: z.string().max(500).nullable().optional(),
      pinCite: z.string().max(120).nullable().optional(),
      quote: z.string().max(4000).nullable().optional(),
      userNote: z.string().max(2000).nullable().optional(),
      orderIndex: z.number().int().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      thread_id: data.threadId,
      user_id: context.userId,
      kind: data.kind,
      stance: data.stance ?? null,
      identifier: data.identifier ?? null,
      citation: data.citation ?? null,
      heading: data.heading ?? null,
      pin_cite: data.pinCite ?? null,
      quote: data.quote ?? null,
      user_note: data.userNote ?? null,
      order_index: data.orderIndex ?? 0,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("workspace_case_items")
        .update(payload)
        .eq("id", data.id)
        .select("id,kind,stance,identifier,citation,heading,pin_cite,quote,user_note,order_index,created_at")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("workspace_case_items")
      .insert(payload)
      .select("id,kind,stance,identifier,citation,heading,pin_cite,quote,user_note,order_index,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_case_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Draft version history (last 20 kept; user-restorable) ─────────────────
export const snapshotDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      title: z.string().max(200).optional(),
      bodyMd: z.string().max(500_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_draft_versions")
      .insert({
        thread_id: data.threadId,
        user_id: context.userId,
        title: data.title ?? null,
        body_md: data.bodyMd,
      });
    if (error) throw new Error(error.message);
    // Trim to most recent 20
    const { data: rows } = await context.supabase
      .from("workspace_draft_versions")
      .select("id")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false });
    if (rows && rows.length > 20) {
      const stale = rows.slice(20).map((r) => r.id);
      await context.supabase.from("workspace_draft_versions").delete().in("id", stale);
    }
    return { ok: true };
  });

export const listDraftVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ThreadIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_draft_versions")
      .select("id,title,created_at,body_md")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ── Cite-check (read-only; user-triggered) ────────────────────────────────
const CITE_RX = /\b(\d+)\s+(U\.S\.C\.|C\.F\.R\.|USC|CFR)\s+§*\s*([\w.\-]+)/gi;

export const citeCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().uuid(),
      text: z.string().min(1).max(500_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const matches = Array.from(data.text.matchAll(CITE_RX));
    const seen = new Map<string, { raw: string; identifier: string; citation: string }>();
    for (const m of matches) {
      const isUsc = m[2].toUpperCase().startsWith("U");
      const title = m[1];
      const section = m[3];
      // Match the corpus identifier scheme exactly:
      //   USC → /usc/title-42/section-1983
      //   CFR → /us/cfr/t1/s§ 1.1
      const ident = isUsc
        ? `/usc/title-${title}/section-${section}`
        : `/us/cfr/t${title}/s§ ${section}`;
      if (!seen.has(ident)) {
        seen.set(ident, {
          raw: m[0],
          identifier: ident,
          citation: `${title} ${isUsc ? "U.S.C." : "C.F.R."} § ${section}`,
        });
      }
    }
    const cites = Array.from(seen.values());
    if (cites.length === 0) return { cites: [] };

    // Resolve against the LOCAL corpus (documents only exist there).
    const { data: foundRows } = await corpus
      .from("documents")
      .select("identifier")
      .in("identifier", cites.map((c) => c.identifier));
    const found = new Set((foundRows ?? []).map((r: { identifier: string }) => r.identifier));

    const { data: pinnedRows } = await context.supabase
      .from("workspace_case_items")
      .select("identifier")
      .eq("thread_id", data.threadId)
      .in("identifier", cites.map((c) => c.identifier));
    const pinned = new Set((pinnedRows ?? []).map((r: { identifier: string }) => r.identifier));

    return {
      cites: cites.map((c) => ({
        ...c,
        resolves: found.has(c.identifier),
        pinned: pinned.has(c.identifier),
      })),
    };
  });