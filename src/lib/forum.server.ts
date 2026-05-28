// Server-side forum reads for SSR'd permalink pages.
//
// The Floor's interactive list/composer run client-side against the cloud auth
// project with the user's JWT (see forum.data.ts). But a post's PERMALINK page
// must be server-rendered so crawlers see the title, body, and meta tags — that's
// the whole SEO point. Posts are public-read under RLS, so we read them here with
// the cloud project's ANON (publishable) key, server-side, no session. Never use
// the local corpus client for this — forum tables live on the cloud project.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ForumPostCitation = {
  identifier: string;
  source_code: string | null;
  heading_snapshot: string | null;
  section_label_snapshot: string | null;
};

export type ForumReply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string | null;
};

export type ForumPostDetail = {
  id: string;
  title: string;
  body: string;
  kind: string;
  pinned: boolean;
  created_at: string;
  display_name: string | null;
  citations: ForumPostCitation[];
  replies: ForumReply[];
};

async function cloudAnonClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
  const key =
    process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing cloud auth env (SUPABASE_AUTH_URL / SUPABASE_AUTH_PUBLISHABLE_KEY) for forum SSR reads.",
    );
  }
  // Untyped: the generated Database types describe the local corpus, not this
  // project's auth schema. We type the rows at the call site instead.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type PostRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: string | null;
  pinned: boolean;
  created_at: string;
};

type ReplyRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export const getForumPost = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(8).max(64) }))
  .handler(async ({ data }): Promise<{ post: ForumPostDetail | null }> => {
    const sb = await cloudAnonClient();
    const { data: post } = await sb
      .from("forum_posts")
      .select("id, user_id, title, body, kind, pinned, created_at")
      .eq("id", data.id)
      .maybeSingle<PostRow>();
    if (!post) return { post: null };

    // Citations + the thread's replies in parallel; profiles resolved after, in
    // one query covering the post author and every reply author.
    const [{ data: cites }, { data: replyRows }] = await Promise.all([
      sb
        .from("forum_post_citations")
        .select("identifier, source_code, heading_snapshot, section_label_snapshot")
        .eq("post_id", post.id),
      sb
        .from("forum_replies")
        .select("id, user_id, body, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .returns<ReplyRow[]>(),
    ]);

    const replies = replyRows ?? [];
    const userIds = Array.from(new Set([post.user_id, ...replies.map((r) => r.user_id)]));
    const { data: profiles } = await sb
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds)
      .returns<{ user_id: string; display_name: string | null }[]>();
    const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

    return {
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        kind: post.kind ?? "discussion",
        pinned: post.pinned,
        created_at: post.created_at,
        display_name: nameByUser.get(post.user_id) ?? null,
        citations: (cites ?? []) as ForumPostCitation[],
        replies: replies.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          body: r.body,
          created_at: r.created_at,
          display_name: nameByUser.get(r.user_id) ?? null,
        })),
      },
    };
  });
