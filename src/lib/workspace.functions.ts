// Workspace server functions — kept thin and backend-agnostic on purpose.
// All persistence goes through these fns; swap the storage layer by rewriting
// this file + the chat route's tool handlers.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase.rpc as unknown as (
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
      const kind = m[2].toUpperCase().startsWith("U") ? "usc" : "cfr";
      const ident = `${kind}/${m[1]}/${m[3]}`;
      if (!seen.has(ident)) {
        seen.set(ident, {
          raw: m[0],
          identifier: ident,
          citation: `${m[1]} ${kind.toUpperCase()} § ${m[3]}`,
        });
      }
    }
    const cites = Array.from(seen.values());
    if (cites.length === 0) return { cites: [] };

    const { data: foundRows } = await context.supabase
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