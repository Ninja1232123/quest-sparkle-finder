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