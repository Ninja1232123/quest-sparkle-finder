import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type StackItem = {
  name: string;
  size: number;
  mime: string;
  updated_at: string;
};

const SKIP = (n: string) =>
  n.endsWith(".filepart") || n.endsWith(".crdownload") || n.startsWith(".");

const guessMime = (n: string, fallback: string): string => {
  const ext = n.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "md") return "text/markdown";
  if (ext === "txt") return "text/plain";
  if (ext === "zip") return "application/zip";
  if (ext === "rar") return "application/vnd.rar";
  return fallback || "application/octet-stream";
};

export const listStackItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin.storage.from("docs").list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) return { items: [] as StackItem[], error: error.message };
  const items: StackItem[] = (data ?? [])
    .filter((o) => o.name && !SKIP(o.name) && (o.metadata?.size ?? 0) > 0)
    .map((o) => ({
      name: o.name,
      size: Number(o.metadata?.size ?? 0),
      mime: guessMime(o.name, String(o.metadata?.mimetype ?? "")),
      updated_at: (o.updated_at ?? o.created_at ?? new Date().toISOString()) as string,
    }));
  return { items, error: null as string | null };
});

export const getStackSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().min(1).max(500) }))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const { data: signed, error } = await supabaseAdmin.storage
      .from("docs")
      .createSignedUrl(data.name, 60 * 30); // 30 min
    if (error || !signed) return { url: null as string | null, error: error?.message ?? "Not found" };
    return { url: signed.signedUrl, error: null as string | null };
  });
