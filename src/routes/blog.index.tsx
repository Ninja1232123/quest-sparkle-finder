import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { listPublishedPosts } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "Blog · Marginalia" },
      { name: "description", content: "Notes, primers, and explainers on federal law, agency rulemaking, and how to read a statute." },
      { property: "og:title", content: "Blog · Marginalia" },
      { property: "og:description", content: "Notes, primers, and explainers on federal law, agency rulemaking, and how to read a statute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/blog" }],
  }),
});

function fmtDate(s: string | null): string {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ""; }
}

function BlogIndex() {
  const fetchPosts = useServerFn(listPublishedPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["blog", "list"],
    queryFn: () => fetchPosts({ data: { limit: 30 } }),
  });
  const posts = data?.posts ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="citation-tag text-accent">notes from the index</div>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Blog</h1>
        <p className="mt-3 text-foreground/70 leading-relaxed">
          Short reads on how federal statutes, regs, and agency manuals fit together — and how
          a non-lawyer can read them with confidence.
        </p>

        <div className="mt-12 divide-y divide-border/60">
          {isLoading && <div className="py-12 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && posts.length === 0 && (
            <div className="py-12 text-sm text-muted-foreground">No posts yet — check back soon.</div>
          )}
          {posts.map((p) => (
            <article key={p.id} className="py-8">
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="group block">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={p.published_at ?? undefined}>{fmtDate(p.published_at)}</time>
                  {p.tags.length > 0 && <span>·</span>}
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>
                  ))}
                </div>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight group-hover:underline">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-2 text-foreground/75 leading-relaxed">{p.excerpt}</p>
                )}
                <span className="mt-3 inline-block text-sm text-accent">Read →</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}