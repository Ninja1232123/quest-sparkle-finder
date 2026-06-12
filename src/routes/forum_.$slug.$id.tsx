import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getForumPost, type ForumPostDetail, type ForumReply } from "@/lib/forum.server";
import { postSlug, createForumReply, deleteForumReply, fetchForumReplies } from "@/lib/forum.data";
import { ArrowLeft, Link2, MessageSquare, ScrollText, Trash2 } from "lucide-react";

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

export const Route = createFileRoute("/forum_/$slug/$id")({
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
    if (!p) return { meta: [{ title: "Post not found · The Floor · Self-Law" }] };
    const desc = p.body.replace(/\s+/g, " ").trim().slice(0, 155);
    const url = `https://self-law.org/forum/${postSlug(p.title)}/${p.id}`;
    const title = `${p.title} · The Floor · Self-Law`;
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
  const { user } = useAuth();
  const date = new Date(post.created_at);
  const canonicalUrl = `https://self-law.org/forum/${postSlug(post.title)}/${post.id}`;

  // Replies are SSR'd (in the loader) for SEO, then become client state so a
  // posted/deleted reply updates without a full reload.
  const [replies, setReplies] = useState<ForumReply[]>(post.replies);
  const refresh = () => fetchForumReplies(post.id).then((r) => setReplies(r.replies));

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
    publisher: { "@type": "Organization", name: "Self-Law" },
    commentCount: post.replies.length,
    comment: post.replies.map((r: { body: string; created_at: string; display_name: string | null }) => ({
      "@type": "Comment",
      text: r.body,
      dateCreated: r.created_at,
      author: { "@type": "Person", name: r.display_name ?? "anon" },
    })),
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
              {post.citations.map((c: { identifier: string }) => (
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

        {/* Discussion thread */}
        <section className="mt-12 border-t border-border/60 pt-8">
          <h2 className="citation-tag flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {replies.length === 0
              ? "discussion"
              : `discussion · ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
          </h2>

          {replies.length > 0 && (
            <ul className="mt-5 space-y-5">
              {replies.map((r) => (
                <li key={r.id} className="group rounded-2xl border border-border/60 bg-card p-5">
                  <div className="citation-tag flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground/70">{r.display_name ?? "anon"}</span>
                      <span>·</span>
                      <time dateTime={r.created_at}>
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </span>
                    {user?.id === r.user_id && (
                      <button
                        aria-label="Delete reply"
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        onClick={async () => {
                          if (!confirm("Delete this reply?")) return;
                          await deleteForumReply(r.id);
                          refresh();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap font-serif text-[15px] leading-[1.7] text-foreground/85">
                    {r.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            {user ? (
              <ReplyComposer postId={post.id} onPosted={refresh} />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-8 text-center">
                <p className="text-sm text-foreground/60">
                  {replies.length === 0
                    ? "No replies yet. Sign in to start the discussion."
                    : "Sign in to join the discussion."}
                </p>
                <Link
                  to="/auth"
                  search={{ mode: "login", redirect: undefined }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Sign in to reply
                </Link>
              </div>
            )}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-foreground/55">
            Replies are research and opinion, not legal advice. If it's about the law, cite the
            section. Validate any interpretation with a licensed attorney in your jurisdiction
            before you act on it.
          </p>
        </section>
      </article>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

function ReplyComposer({ postId, onPosted }: { postId: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createForumReply(postId, body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    onPosted();
  }

  return (
    <div className="rounded-2xl border bg-card/60 p-5">
      <label htmlFor="reply-body" className="citation-tag text-muted-foreground">
        add to the discussion
      </label>
      <Textarea
        id="reply-body"
        className="mt-2 min-h-[120px] text-[15px] leading-relaxed"
        placeholder="Keep it useful and honest. Bring receipts — cite the section if it's about the law."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">{body.length} / 4000</span>
        {error && <span className="text-xs text-destructive">{error}</span>}
        <Button onClick={submit} disabled={busy || body.trim().length < 2}>
          {busy ? "Posting…" : "Post reply"}
        </Button>
      </div>
    </div>
  );
}
