import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { getForumPost, type ForumPostDetail } from "@/lib/forum.server";
import { postSlug } from "@/lib/forum.data";
import { ArrowLeft, Link2, MessageSquare, ScrollText } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

const KIND_TAG: Record<string, string> = {
  discussion: "discussion",
  feedback: "feedback",
  bug: "bug report",
};

// Kind → accent, using the live design tokens.
function kindPill(kind: string): string {
  switch (kind) {
    case "bug":
      return "border-destructive/40 text-destructive";
    case "feedback":
      return "border-terracotta/40 text-terracotta";
    default:
      return "border-sage/50 text-sage-deep";
  }
}

export const Route = createFileRoute("/forum/$slug/$id")({
  loader: async ({ params }) => {
    const { post } = await getForumPost({ data: { id: params.id } });
    if (!post) throw notFound();
    // Canonicalize a stale/cosmetic slug so every post has exactly one indexable URL.
    const canonical = postSlug(post.title);
    if (params.slug !== canonical) {
      throw redirect({
        to: "/forum/$slug/$id",
        params: { slug: canonical, id: post.id },
        statusCode: 301,
      });
    }
    return { post };
  },
  component: PostPage,
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <div className="h-3 w-28 animate-pulse rounded bg-muted/60" />
        <div className="mt-5 h-9 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </article>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto mt-24 max-w-md px-6 text-center">
        <ScrollText className="mx-auto h-10 w-10 text-foreground/30" />
        <h1 className="mt-4 font-display text-2xl">This post isn't on the floor.</h1>
        <p className="mt-2 text-sm text-foreground/60">
          It may have been deleted, or the link is wrong.
        </p>
        <Link to="/forum" className="mt-6 inline-block text-sm text-terracotta hover:underline">
          ← Back to The Floor
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
  head: ({ loaderData }) => {
    const p = loaderData?.post as ForumPostDetail | undefined;
    if (!p) return { meta: [{ title: "Post not found · The Floor · Marginalia" }] };
    const desc = p.body.replace(/\s+/g, " ").trim().slice(0, 155);
    const url = `https://self-law.org/forum/${postSlug(p.title)}/${p.id}`;
    const title = `${p.title} · The Floor · Marginalia`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:title", content: p.title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function PostPage() {
  const { post } = Route.useLoaderData();
  const date = new Date(post.created_at);
  const canonicalUrl = `https://self-law.org/forum/${postSlug(post.title)}/${post.id}`;

  // Structured data for rich results. Rendered server-side into the document so
  // crawlers pick it up; JSON-LD is valid anywhere in the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    articleBody: post.body,
    datePublished: post.created_at,
    url: canonicalUrl,
    author: { "@type": "Person", name: post.display_name ?? "anon" },
    publisher: { "@type": "Organization", name: "Marginalia" },
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-2xl px-6 pt-12 pb-24 md:pt-16">
        <Link
          to="/forum"
          className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> The Floor
        </Link>

        {/* byline */}
        <div className="citation-tag mt-8 flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="text-foreground/70">{post.display_name ?? "anon"}</span>
          <span>·</span>
          <time dateTime={post.created_at}>
            {date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </time>
          {post.pinned && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              pinned
            </span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${kindPill(post.kind)}`}>
            {KIND_TAG[post.kind] ?? post.kind}
          </span>
        </div>

        <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-8 whitespace-pre-wrap font-serif text-[17px] leading-[1.7] text-foreground/85">
          {post.body}
        </div>

        {post.citations.length > 0 && (
          <div className="mt-10 border-t border-border/60 pt-5">
            <div className="citation-tag text-muted-foreground">on the record</div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {post.citations.map((c) => (
                <li key={c.identifier}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.identifier.replace(/^\//, "") }}
                    search={{ q: undefined }}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs hover:border-foreground/50"
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span className="citation-tag shrink-0 text-foreground/70">
                      {SOURCE_LABELS[c.source_code ?? ""] ?? (c.source_code ?? "").toUpperCase()}
                    </span>
                    <span className="truncate font-display">
                      {c.section_label_snapshot ?? c.heading_snapshot ?? c.identifier}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Discussion — replies land here next. */}
        <div className="mt-12 rounded-3xl border border-dashed border-border/70 bg-card/40 p-6 text-center">
          <MessageSquare className="mx-auto h-5 w-5 text-foreground/30" />
          <p className="mt-2 text-sm text-foreground/60">
            Replies are coming to the floor. For now, start a new post and cite this one.
          </p>
          <Link
            to="/forum"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
          >
            Back to The Floor
          </Link>
        </div>
      </article>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
