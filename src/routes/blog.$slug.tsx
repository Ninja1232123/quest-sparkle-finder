import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { getPostBySlug } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const res = await getPostBySlug({ data: { slug: params.slug } });
    if (!res.post) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return { meta: [{ title: "Post · Marginalia" }] };
    const title = post.seo_title || `${post.title} · Marginalia`;
    const description = post.seo_description || post.excerpt || `${post.title} — Marginalia blog.`;
    const url = `https://self-law.org/blog/${post.slug}`;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: post.cover_image_url ? "summary_large_image" : "summary" },
      ...(post.published_at ? [{ property: "article:published_time", content: post.published_at }] : []),
      ...(post.cover_image_url
        ? [
            { property: "og:image", content: post.cover_image_url },
            { name: "twitter:image", content: post.cover_image_url },
          ]
        : []),
    ];
    const ld = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { "@type": "Person", name: post.author_name || "Marginalia" },
      image: post.cover_image_url || undefined,
      mainEntityOfPage: url,
    };
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  component: BlogPostPage,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Post not found</h1>
        <Link to="/blog" className="mt-6 inline-block text-accent">← Back to blog</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Couldn't load this post</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/blog" className="mt-6 inline-block text-accent">← Back to blog</Link>
      </div>
      <SiteFooter />
    </div>
  ),
});

function fmtDate(s: string | null): string {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ""; }
}

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  if (!post) return null;
  const html = DOMPurify.sanitize(
    marked.parse(post.body_md || "", { async: false }) as string,
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← All posts</Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={post.published_at ?? undefined}>{fmtDate(post.published_at)}</time>
          {post.tags.length > 0 && <span>·</span>}
          {post.tags.map((t: string) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>
          ))}
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-4 text-xl leading-relaxed text-foreground/75">{post.excerpt}</p>
        )}
        {post.author_name && (
          <p className="mt-4 text-sm text-muted-foreground">By {post.author_name}</p>
        )}
        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="mt-8 w-full rounded-2xl border border-border/60 object-cover"
            loading="eager"
          />
        )}
        <div
          className="prose prose-neutral dark:prose-invert mt-10 max-w-none prose-headings:font-display prose-headings:font-semibold prose-a:text-accent prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-16 border-t border-border/60 pt-8">
          <Link to="/blog" className="text-sm text-accent">← More posts</Link>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}