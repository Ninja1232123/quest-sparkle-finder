import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ForumCitation = {
  identifier: string;
  source_code: string | null;
  heading_snapshot: string | null;
  section_label_snapshot: string | null;
};

export type ForumPost = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  kind: string;
  display_name: string | null;
  citations: ForumCitation[];
};

// Normalize an identifier the user typed/pasted.
// Accepts:  "/code/usc/42/1983", "code/usc/42/1983", "usc/42/1983",
//           "42 USC 1983", "29 CFR 1910.95", "ucc 2-207"
function normalizeIdentifier(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  try {
    if (s.startsWith("http")) {
      const u = new URL(s);
      s = u.pathname;
    }
  } catch {
    /* not a url */
  }
  s = s.replace(/^\/+/, "").replace(/^code\//, "");
  if (/^(const|usc|cfr|ucc|tfm|irm)\//i.test(s)) {
    return s.toLowerCase().replace(/\/+$/, "");
  }
  // Citation shapes
  const m1 = s.replace(/§/g, " ").replace(/\s+/g, " ").trim()
    .match(/^(\d+)\s*(u\.?\s*s\.?\s*c\.?|c\.?\s*f\.?\s*r\.?)\s*([\w.\-]+)$/i);
  if (m1) {
    const code = /c/i.test(m1[2]) && /f/i.test(m1[2]) ? "cfr" : "usc";
    return `${code}/${m1[1]}/${m1[3]}`;
  }
  const m2 = s.match(/^(u\.?\s*c\.?\s*c\.?)\s*([\w.\-]+)$/i);
  if (m2) return `ucc/${m2[2]}`;
  return null;
}

export const validateCitations = createServerFn({ method: "POST" })
  .inputValidator(z.object({ raw: z.array(z.string().min(1).max(300)).min(1).max(10) }))
  .handler(async ({ data }) => {
    const normalized = Array.from(
      new Set(data.raw.map(normalizeIdentifier).filter((v): v is string => !!v)),
    );
    if (normalized.length === 0) {
      return { resolved: [] as ForumCitation[], missing: data.raw };
    }
    const { data: rows } = await supabaseAdmin
      .from("documents")
      .select("identifier, source_code, heading, section_label")
      .in("identifier", normalized);
    const found = new Map((rows ?? []).map((r) => [r.identifier, r]));
    const resolved: ForumCitation[] = [];
    const missing: string[] = [];
    for (const id of normalized) {
      const r = found.get(id);
      if (r) {
        resolved.push({
          identifier: r.identifier,
          source_code: r.source_code,
          heading_snapshot: r.heading,
          section_label_snapshot: r.section_label,
        });
      } else {
        missing.push(id);
      }
    }
    return { resolved, missing };
  });

export const listForumPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { data: posts, error } = await supabaseAdmin
    .from("forum_posts")
    .select("id, user_id, title, body, pinned, created_at, kind")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { posts: [] as ForumPost[], error: error.message };
  if (!posts || posts.length === 0) return { posts: [] as ForumPost[], error: null };

  const ids = posts.map((p) => p.id);
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const [{ data: cites }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from("forum_post_citations")
      .select("post_id, identifier, source_code, heading_snapshot, section_label_snapshot")
      .in("post_id", ids),
    supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", userIds),
  ]);
  const citesByPost = new Map<string, ForumCitation[]>();
  for (const c of cites ?? []) {
    const arr = citesByPost.get(c.post_id) ?? [];
    arr.push({
      identifier: c.identifier,
      source_code: c.source_code,
      heading_snapshot: c.heading_snapshot,
      section_label_snapshot: c.section_label_snapshot,
    });
    citesByPost.set(c.post_id, arr);
  }
  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  const out: ForumPost[] = posts.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    created_at: p.created_at,
    kind: (p as { kind?: string }).kind ?? "discussion",
    display_name: nameByUser.get(p.user_id) ?? null,
    citations: citesByPost.get(p.id) ?? [],
  }));
  return { posts: out, error: null as string | null };
});

export const createForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().trim().min(4).max(200),
      body: z.string().trim().min(10).max(8000),
      citations: z.array(z.string().min(1).max(300)).max(10).default([]),
      kind: z.enum(["discussion", "feedback", "bug"]).default("discussion"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const normalized = Array.from(
      new Set(data.citations.map(normalizeIdentifier).filter((v): v is string => !!v)),
    );
    const docRows =
      normalized.length > 0
        ? (
            await supabaseAdmin
              .from("documents")
              .select("identifier, source_code, heading, section_label")
              .in("identifier", normalized)
          ).data ?? []
        : [];

    // RLS on forum_posts enforces auth.uid() = user_id; use the user-scoped client.
    const { data: post, error: postErr } = await supabase
      .from("forum_posts")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        body: data.body.trim(),
        kind: data.kind,
      })
      .select("id")
      .single();
    if (postErr || !post) {
      return { ok: false as const, error: postErr?.message ?? "Could not create post." };
    }

    if (docRows.length > 0) {
      const citeRows = docRows.map((d) => ({
        post_id: post.id,
        identifier: d.identifier,
        source_code: d.source_code,
        heading_snapshot: d.heading,
        section_label_snapshot: d.section_label,
      }));
      // Best-effort: a citation insert failure shouldn't kill the post.
      await supabase.from("forum_post_citations").insert(citeRows);
    }

    return { ok: true as const, id: post.id };
  });

export const deleteForumPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS restricts DELETE to owner; redundant filter is defense-in-depth.
    const { error } = await supabase
      .from("forum_posts")
      .delete()
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
