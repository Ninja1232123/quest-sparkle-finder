// Forum data layer — runs CLIENT-SIDE.
//
// Forum tables (forum_posts, forum_post_citations, profiles) live on the CLOUD
// Supabase project, where auth + RLS live, so we use the authenticated cloud
// client (`supabaseAuth`): it carries the user's JWT, and RLS is the security
// boundary (public read; insert/delete only your own rows). Citation validation
// reads the LOCAL public corpus (`documents`) via the local client.
//
// Replaces the old server-fn version (forum.functions.ts), which pointed at the
// local backend + sessionless server-side auth and could never work.

import { supabaseAuth } from "@/integrations/supabase/auth-client";
import { supabase as localData } from "@/integrations/supabase/client";

export type ForumCitation = {
  identifier: string;
  source_code: string | null;
  heading_snapshot: string | null;
  section_label_snapshot: string | null;
};

export type ForumPost = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  kind: string;
  display_name: string | null;
  is_owner: boolean;
  citations: ForumCitation[];
};

export type PostKind = "discussion" | "feedback" | "bug";

// SEO-friendly permalink for a post. The UUID id is authoritative (lookups go by
// id); the slug is cosmetic keyword bait in the URL. Detail route canonicalizes a
// stale slug via 301, so links never rot when a title is edited.
export function postSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

export function postPath(p: { id: string; title: string }): string {
  return `/forum/${postSlug(p.title)}/${p.id}`;
}

// Normalize an identifier the user typed/pasted into a corpus path.
export function normalizeIdentifier(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  try {
    if (s.startsWith("http")) s = new URL(s).pathname;
  } catch {
    /* not a url */
  }
  s = s.replace(/^\/+/, "").replace(/^code\//, "");
  if (/^(const|usc|cfr|ucc|tfm|irm|bill|register|statutes-at-large|statute-compilations|public-private-law|public-papers-president)\//i.test(s)) {
    return s.toLowerCase().replace(/\/+$/, "");
  }
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

// Resolve raw citation strings against the LOCAL corpus (documents view).
async function resolveCitations(raw: string[]): Promise<{ resolved: ForumCitation[]; missing: string[] }> {
  const normalized = Array.from(new Set(raw.map(normalizeIdentifier).filter((v): v is string => !!v)));
  if (normalized.length === 0) return { resolved: [], missing: raw };
  const { data: rows } = await localData
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
}

export async function validateCitations(raw: string[]) {
  return resolveCitations(raw);
}

export async function fetchForumPosts(): Promise<{ posts: ForumPost[]; error: string | null }> {
  const { data: posts, error } = await supabaseAuth
    .from("forum_posts")
    .select("id, user_id, title, body, pinned, created_at, kind")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { posts: [], error: error.message };
  if (!posts || posts.length === 0) return { posts: [], error: null };

  const ids = posts.map((p) => p.id);
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const { data: auth } = await supabaseAuth.auth.getUser();
  const viewerId = auth?.user?.id ?? null;

  const [{ data: cites }, { data: profiles }] = await Promise.all([
    supabaseAuth
      .from("forum_post_citations")
      .select("post_id, identifier, source_code, heading_snapshot, section_label_snapshot")
      .in("post_id", ids),
    supabaseAuth.from("profiles").select("user_id, display_name").in("user_id", userIds),
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
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    created_at: p.created_at,
    kind: (p as { kind?: string }).kind ?? "discussion",
    display_name: nameByUser.get(p.user_id) ?? null,
    is_owner: !!viewerId && viewerId === p.user_id,
    citations: citesByPost.get(p.id) ?? [],
  }));
  return { posts: out, error: null };
}

export async function createForumPost(input: {
  title: string;
  body: string;
  citations: string[];
  kind: PostKind;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: auth } = await supabaseAuth.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in to post." };

  const { resolved } = await resolveCitations(input.citations);

  const { data: post, error: postErr } = await supabaseAuth
    .from("forum_posts")
    .insert({ user_id: userId, title: input.title.trim(), body: input.body.trim(), kind: input.kind })
    .select("id")
    .single();
  if (postErr || !post) return { ok: false, error: postErr?.message ?? "Could not create post." };

  if (resolved.length > 0) {
    // Best-effort: a citation insert failure shouldn't lose the post.
    await supabaseAuth.from("forum_post_citations").insert(
      resolved.map((c) => ({
        post_id: post.id,
        identifier: c.identifier,
        source_code: c.source_code,
        heading_snapshot: c.heading_snapshot,
        section_label_snapshot: c.section_label_snapshot,
      })),
    );
  }
  return { ok: true, id: post.id };
}

export async function deleteForumPost(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAuth.from("forum_posts").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
