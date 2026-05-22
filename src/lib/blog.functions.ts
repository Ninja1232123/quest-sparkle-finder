import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function assertAdmin(userId: string) {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) throw new Error("Server is missing ADMIN_USER_ID");
  if (userId !== adminId) throw new Error("Forbidden");
}

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  author_name: string | null;
  updated_at: string;
  created_at: string;
};

export type BlogPost = BlogPostSummary & {
  body_md: string;
  seo_title: string | null;
  seo_description: string | null;
  view_count: number;
};

const SUMMARY_COLS =
  "id, slug, title, excerpt, cover_image_url, tags, published, published_at, author_name, updated_at, created_at";
const FULL_COLS = SUMMARY_COLS + ", body_md, seo_title, seo_description, view_count";

// Public: list published posts
export const listPublishedPosts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).default(20), tag: z.string().min(1).max(40).optional() }))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    let q = admin
      .from("blog_posts")
      .select(SUMMARY_COLS)
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (data.tag) q = q.contains("tags", [data.tag]);
    const { data: rows, error } = await q;
    if (error) return { posts: [] as BlogPostSummary[], error: error.message };
    return { posts: (rows ?? []) as BlogPostSummary[], error: null };
  });

// Public: get a published post by slug
export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("blog_posts")
      .select(FULL_COLS)
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) return { post: null as BlogPost | null, error: error.message };
    if (!row) return { post: null, error: "Not found" };
    const post = row as unknown as BlogPost;
    // Fire-and-forget view bump
    admin.from("blog_posts").update({ view_count: post.view_count + 1 }).eq("id", post.id).then(() => {}, () => {});
    return { post, error: null };
  });

// Admin: list all posts (including drafts)
export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.userId);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("blog_posts")
      .select(SUMMARY_COLS)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) return { posts: [] as BlogPostSummary[], error: error.message };
    return { posts: (data ?? []) as BlogPostSummary[], error: null };
  });

// Admin: get a single post by id (any state)
export const adminGetPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const admin = await getAdmin();
    const { data: row, error } = await admin.from("blog_posts").select(FULL_COLS).eq("id", data.id).maybeSingle();
    if (error) return { post: null as BlogPost | null, error: error.message };
    return { post: (row as unknown as BlogPost) ?? null, error: row ? null : "Not found" };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers, and hyphens only").min(1).max(120),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional().nullable(),
  body_md: z.string().max(200_000).default(""),
  cover_image_url: z.string().url().max(800).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  published: z.boolean().default(false),
  author_name: z.string().max(120).optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(300).optional().nullable(),
});

export const adminUpsertPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertSchema)
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const admin = await getAdmin();
    const now = new Date().toISOString();
    const payload = {
      author_id: context.userId,
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt ?? null,
      body_md: data.body_md,
      cover_image_url: data.cover_image_url ?? null,
      tags: data.tags,
      published: data.published,
      published_at: data.published ? now : null,
      author_name: data.author_name ?? null,
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
    };

    if (data.id) {
      // Preserve original published_at if already published
      const { data: existing } = await admin.from("blog_posts").select("published_at, published").eq("id", data.id).maybeSingle();
      const keepPubAt = existing?.published && existing.published_at ? existing.published_at : payload.published_at;
      const { data: row, error } = await admin
        .from("blog_posts")
        .update({ ...payload, published_at: data.published ? keepPubAt : null })
        .eq("id", data.id)
        .select("id, slug")
        .single();
      if (error) return { id: null as string | null, slug: null as string | null, error: error.message };
      return { id: row.id, slug: row.slug, error: null };
    }

    const { data: row, error } = await admin.from("blog_posts").insert(payload).select("id, slug").single();
    if (error) return { id: null as string | null, slug: null as string | null, error: error.message };
    return { id: row.id, slug: row.slug, error: null };
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("blog_posts").delete().eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

// Lightweight check used by admin UI routes to gate rendering.
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminId = process.env.ADMIN_USER_ID;
    return { isAdmin: !!adminId && context.userId === adminId };
  });

// Used by the sitemap route — service role read.
export async function listPublishedSlugsForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as { slug: string; updated_at: string }[];
}