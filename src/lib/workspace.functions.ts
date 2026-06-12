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