import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchForumPosts,
  validateCitations,
  createForumPost,
  deleteForumPost,
  postSlug,
  type ForumCitation,
  type ForumPost,
} from "@/lib/forum.data";
import { Trash2, Link2, Plus, X, ScrollText, Users, Bot, MessageSquare } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

type PostKind = "discussion" | "feedback" | "bug";

const KIND_META: Record<PostKind, { label: string; tag: string; hint: string }> = {
  discussion: {
    label: "Discussion",
    tag: "discussion",
    hint: "Talk shop. Citations welcome — bring receipts when you can.",
  },
  feedback: {
    label: "Feedback",
    tag: "feedback",
    hint: "What's working, what isn't, what you wish was here.",
  },
  bug: {
    label: "Bug report",
    tag: "bug",
    hint: "What you did, what you expected, what actually happened. Include the URL.",
  },
};

// Kind → accent, using the live design tokens (terracotta/sage/destructive).
function kindPillClass(kind: string): string {
  switch (kind) {
    case "bug":
      return "border-destructive/40 text-destructive";
    case "feedback":
      return "border-terracotta/40 text-terracotta";
    default:
      return "border-sage/50 text-sage-deep";
  }
}

export const Route = createFileRoute("/forum")({
  component: ForumPage,
  head: () => ({
    meta: [
      { title: "The Floor · Marginalia" },
      {
        name: "description",
        content:
          "A single page where every post is anchored to a real cited document. No theory, no hearsay — only what's on the record.",
      },
      { property: "og:title", content: "The Floor · Marginalia" },
      { property: "og:description", content: "Citation-only. No claim without a document." },
    ],
  }),
});

function ForumPage() {
  const { user, loading } = useAuth();
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<"all" | PostKind>("all");
  const [data, setData] = useState<{ posts: ForumPost[]; error: string | null }>({ posts: [], error: null });

  const reload = useCallback(() => {
    fetchForumPosts().then(setData);
  }, []);
  // Load on mount and refetch once auth resolves (so is_owner / delete buttons are correct).
  useEffect(() => { reload(); }, [reload, user?.id]);

  const shown = data.posts.filter(
    (p) => filter === "all" || (p.kind ?? "discussion") === filter,
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Masthead */}
      <section className="border-b border-foreground/15">
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-10 md:pt-28 md:pb-14">
          <div className="citation-tag text-muted-foreground">members' floor · post no. 0001</div>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-7xl">
            The Floor.
          </h1>
          <p className="mt-5 max-w-xl font-serif text-lg italic text-foreground/70 md:text-xl">
            One room. One rule of thumb. <span className="font-display not-italic font-bold">If you can cite it, cite it.</span>
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/65">
            Discussion, feedback, and bug reports all live here. When a post is about the
            law, link the section in the Code so anyone can read the source themselves —
            that's what makes this place useful. Anything you read here, including AI
            summaries, should be checked against the actual document and, before you act
            on it, a licensed attorney in your jurisdiction.
          </p>
        </div>
      </section>

      {/* Tab bar */}
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pt-6">
          <span className="-mb-px inline-flex items-center gap-2 border-b-2 border-foreground px-1 pb-3 font-display text-sm font-semibold text-foreground">
            <Users className="h-3.5 w-3.5" /> The Floor
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {data.posts.length}
            </span>
          </span>
          <span
            className="-mb-px inline-flex cursor-default items-center gap-2 px-1 pb-3 font-display text-sm font-semibold text-foreground/35"
            title="A daily, citation-grounded brief — coming soon"
          >
            <Bot className="h-3.5 w-3.5" /> The Brief
            <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70">
              soon
            </span>
          </span>

          {/* Actions, right-aligned */}
          <div className="ml-auto flex items-center gap-2 pb-2">
            {user ? (
              <button
                onClick={() => setComposing((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
              >
                {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {composing ? "Close" : "Post to the floor"}
              </button>
            ) : !loading ? (
              <Link
                to="/auth"
                search={{ mode: "login", redirect: undefined }}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Sign in to post
              </Link>
            ) : null}
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {(["all", "discussion", "feedback", "bug"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={
                "rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition " +
                (filter === k
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 text-foreground/55 hover:border-foreground/40 hover:text-foreground")
              }
            >
              {k === "all" ? "all" : k}
            </button>
          ))}
          <span className="ml-1 self-center text-[11px] text-muted-foreground/70">
            Reading is open to everyone, always.
          </span>
        </div>
      </div>

      {/* Composer */}
      {composing && user && (
        <section className="mx-auto max-w-3xl px-6 pt-8">
          <Composer
            onDone={() => {
              setComposing(false);
              reload();
            }}
          />
        </section>
      )}

      {/* Posts */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-32">
        {data.error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {data.error}
          </div>
        )}
        {!data.error && shown.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ScrollText className="mx-auto h-10 w-10 text-foreground/30" />
            <h2 className="mt-4 font-display text-2xl">
              {data.posts.length === 0 ? "The floor is empty." : "Nothing under that filter."}
            </h2>
            <p className="mt-2 text-sm text-foreground/60">
              {data.posts.length === 0
                ? "First post sets the tone. Be useful, be honest."
                : "Try a different tab."}
            </p>
          </div>
        )}

        <ul className="space-y-6">
          {shown.map((p) => (
            <li key={p.id}>
              <PostCard post={p} isOwner={p.is_owner} onDelete={() => reload()} />
            </li>
          ))}
        </ul>
      </section>

      <SiteFooter />
    </div>
  );
}

function PostCard({
  post,
  isOwner,
  onDelete,
}: {
  post: ForumPost;
  isOwner: boolean;
  onDelete: () => void;
}) {
  const href = { slug: postSlug(post.title), id: post.id };
  return (
    <article className="group rounded-3xl border bg-card p-6 paper-grain shadow-[var(--shadow-soft)] transition hover:border-foreground/25 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="citation-tag flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="text-foreground/70">{post.display_name ?? "anon"}</span>
            <span>·</span>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
            {post.pinned && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                pinned
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${kindPillClass(post.kind ?? "discussion")}`}
            >
              {KIND_META[(post.kind as PostKind)]?.tag ?? post.kind}
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight md:text-[28px]">
            <Link
              to="/forum/$slug/$id"
              params={href}
              className="hover:text-terracotta hover:underline decoration-from-font underline-offset-2"
            >
              {post.title}
            </Link>
          </h2>
        </div>
        {isOwner && (
          <button
            aria-label="Delete post"
            className="rounded-md p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={async () => {
              if (!confirm("Delete this post?")) return;
              await deleteForumPost(post.id);
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80">
        {post.body}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        {post.citations.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {post.citations.slice(0, 3).map((c) => (
              <li key={c.identifier}>
                <Link
                  to="/code/$"
                  params={{ _splat: c.identifier.replace(/^\//, "") }}
                  search={{ q: undefined }}
                  className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-foreground/20 bg-background px-2.5 py-1 text-xs hover:border-foreground/50"
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
            {post.citations.length > 3 && (
              <li className="self-center text-[11px] text-muted-foreground">
                +{post.citations.length - 3} more
              </li>
            )}
          </ul>
        ) : (
          <span className="text-[11px] text-muted-foreground/60">no citations</span>
        )}
        <Link
          to="/forum/$slug/$id"
          params={href}
          className="inline-flex shrink-0 items-center gap-1.5 font-display text-sm font-medium italic text-terracotta hover:underline"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Read &amp; discuss →
        </Link>
      </div>
    </article>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<PostKind>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [citationInput, setCitationInput] = useState("");
  const [resolved, setResolved] = useState<ForumCitation[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCitation() {
    const raw = citationInput.trim();
    if (!raw) return;
    setBusy(true);
    setError(null);
    const res = await validateCitations([raw]);
    setBusy(false);
    if (res.resolved.length === 0) {
      setMissing((m) => Array.from(new Set([...m, ...res.missing])));
      setError("Couldn't find that on file. Try '42 USC 1983' or '/usc/15/1692'.");
      return;
    }
    setResolved((r) => {
      const seen = new Set(r.map((x) => x.identifier));
      return [...r, ...res.resolved.filter((c) => !seen.has(c.identifier))];
    });
    setCitationInput("");
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await createForumPost({
      title: title.trim(),
      body: body.trim(),
      citations: resolved.map((r) => r.identifier),
      kind,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-foreground/20 bg-card/60 p-6 md:p-8">
      <div className="citation-tag text-muted-foreground">draft</div>
      <h2 className="mt-1 font-display text-2xl">New post for the floor</h2>

      <div className="mt-6 space-y-4">
        <div>
          <div className="citation-tag text-muted-foreground" role="group" aria-label="Kind of post">kind of post</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {(["discussion", "feedback", "bug"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "rounded-full px-3 py-1.5 font-display font-medium transition " +
                  (kind === k
                    ? "bg-foreground text-background"
                    : "border border-foreground/20 text-foreground/70 hover:border-foreground/50")
                }
              >
                {KIND_META[k].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-foreground/55">{KIND_META[kind].hint}</p>
        </div>
        <div>
          <label htmlFor="forum-title" className="citation-tag text-muted-foreground">title</label>
          <Input
            id="forum-title"
            className="mt-1 h-11 text-base"
            placeholder="Short, factual. e.g. 'How 15 USC 1692g shifted my dispute outcome'"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="forum-body" className="citation-tag text-muted-foreground">what happened</label>
          <Textarea
            id="forum-body"
            className="mt-1 min-h-[180px] text-[15px] leading-relaxed"
            placeholder="State the facts. Quote the section. Skip the editorial — let the document do the work."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">
            {body.length} / 8000
          </div>
        </div>

        <div className="rounded-2xl border bg-background/50 p-4">
          <label htmlFor="forum-citation" className="citation-tag text-muted-foreground">attach citations (optional, encouraged)</label>
          <p className="mt-1 text-xs text-foreground/60">
            If your post is about the law, link the section so others can read the source.
            Paste something like <code className="font-mono">15 USC 1692g</code>,{" "}
            <code className="font-mono">29 CFR 1910.95</code>, or a path like{" "}
            <code className="font-mono">/usc/42/1983</code>. Skip this for feedback or bug reports.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              id="forum-citation"
              value={citationInput}
              onChange={(e) => setCitationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCitation();
                }
              }}
              placeholder="15 USC 1692g"
            />
            <Button type="button" variant="outline" onClick={addCitation} disabled={busy}>
              Resolve
            </Button>
          </div>

          {resolved.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {resolved.map((c) => (
                <li
                  key={c.identifier}
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-background px-3 py-1.5 text-xs"
                >
                  <span className="citation-tag text-foreground/70">
                    {SOURCE_LABELS[c.source_code ?? ""] ?? (c.source_code ?? "").toUpperCase()}
                  </span>
                  <span className="font-display max-w-[20ch] truncate">
                    {c.section_label_snapshot ?? c.heading_snapshot ?? c.identifier}
                  </span>
                  <button
                    aria-label="Remove"
                    onClick={() => setResolved((r) => r.filter((x) => x.identifier !== c.identifier))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <div className="mt-2 text-xs text-destructive">
              Not on file: {missing.join(", ")}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              busy ||
              title.trim().length < 4 ||
              body.trim().length < 10
            }
          >
            {busy ? "Posting…" : "Post to the floor"}
          </Button>
        </div>
      </div>

      <p className="mt-6 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-foreground/55">
        Heads up: anything posted, replied to, or summarized here is research and
        opinion, not legal advice. Validate any interpretation with a licensed attorney
        in your jurisdiction before you act on it.
      </p>
    </div>
  );
}
