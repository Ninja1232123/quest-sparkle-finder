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

export type ForumPostDetail = {
  id: string;
  title: string;
  body: string;
  kind: string;
  pinned: boolean;
  created_at: string;
  display_name: string | null;
  citations: ForumPostCitation[];
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

    const [{ data: cites }, { data: prof }] = await Promise.all([
      sb
        .from("forum_post_citations")
        .select("identifier, source_code, heading_snapshot, section_label_snapshot")
        .eq("post_id", post.id),
      sb.from("profiles").select("display_name").eq("user_id", post.user_id).maybeSingle<{
        display_name: string | null;
      }>(),
    ]);

    return {
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        kind: post.kind ?? "discussion",
        pinned: post.pinned,
        created_at: post.created_at,
        display_name: prof?.display_name ?? null,
        citations: (cites ?? []) as ForumPostCitation[],
      },
    };
  });
