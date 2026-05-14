import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  listForumPosts,
  validateCitations,
  createForumPost,
  deleteForumPost,
  type ForumCitation,
  type ForumPost,
} from "@/lib/forum.functions";
import { Trash2, Link2, Plus, X, ScrollText } from "lucide-react";

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

export const Route = createFileRoute("/forum")({
  loader: () => listForumPosts(),
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
  const initial = Route.useLoaderData();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<"all" | PostKind>("all");

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Spacious masthead */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-10 md:pt-28 md:pb-16">
        <div className="citation-tag text-muted-foreground">members' floor · post no. 0001</div>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-7xl">
          The Floor
        </h1>
        <p className="mt-6 max-w-xl font-display text-lg italic text-foreground/70 md:text-xl">
          One room. One rule of thumb. <span className="not-italic">If you can cite it, cite it.</span>
        </p>
        <p className="mt-4 max-w-xl text-sm text-foreground/65">
          Discussion, feedback, and bug reports all live here. When a post is about the
          law, link the section in the Code so anyone can read the source themselves —
          that's what makes this place useful. Anything you read here, including AI
          summaries, should be checked against the actual document and, before you act
          on it, a licensed attorney in your jurisdiction.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {user ? (
            <Button onClick={() => setComposing((v) => !v)} className="gap-2">
              <Plus className="h-4 w-4" />
              {composing ? "Close composer" : "Post to the floor"}
            </Button>
          ) : !loading ? (
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Sign in to post
            </Link>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Reading is open to everyone, always.
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-1 text-xs">
          {(["all", "discussion", "feedback", "bug"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={
                "rounded-full px-3 py-1.5 transition " +
                (filter === k
                  ? "bg-foreground text-background"
                  : "text-foreground/60 hover:bg-muted hover:text-foreground")
              }
            >
              {k === "all" ? "All" : KIND_META[k].label}
            </button>
          ))}
        </div>
      </section>

      {/* Composer */}
      {composing && user && (
        <section className="mx-auto max-w-3xl px-6 pb-12">
          <Composer
            onDone={() => {
              setComposing(false);
              router.invalidate();
            }}
          />
        </section>
      )}

      {/* Posts */}
      <section className="mx-auto max-w-3xl px-6 pb-32">
        {initial.error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {initial.error}
          </div>
        )}
        {!initial.error && initial.posts.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ScrollText className="mx-auto h-10 w-10 text-foreground/30" />
            <h2 className="mt-4 font-display text-2xl">The floor is empty.</h2>
            <p className="mt-2 text-sm text-foreground/60">
              First post sets the tone. Be useful, be honest.
            </p>
          </div>
        )}

        <ul className="space-y-10">
          {initial.posts
            .filter((p: ForumPost) => filter === "all" || (p.kind ?? "discussion") === filter)
            .map((p: ForumPost) => (
            <li key={p.id}>
              <PostCard
                post={p}
                isOwner={user?.id === p.user_id}
                onDelete={() => router.invalidate()}
              />
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
  const del = useServerFn(deleteForumPost);
  return (
    <article className="group rounded-3xl border bg-card p-6 paper-grain shadow-[var(--shadow-soft)] md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="citation-tag text-muted-foreground">
            {post.display_name ?? "anon"} · {new Date(post.created_at).toLocaleDateString()}
            {post.pinned && (
              <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                pinned
              </span>
            )}
            {post.kind && post.kind !== "discussion" && (
              <span className="ml-2 rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/70">
                {KIND_META[(post.kind as PostKind)]?.tag ?? post.kind}
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight md:text-3xl">
            {post.title}
          </h2>
        </div>
        {isOwner && (
          <button
            aria-label="Delete post"
            className="rounded-md p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={async () => {
              if (!confirm("Delete this post?")) return;
              await del({ data: { id: post.id } });
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">
        {post.body}
      </p>

      {post.citations.length > 0 && (
        <div className="mt-6 border-t border-border/60 pt-4">
          <div className="citation-tag text-muted-foreground">on the record</div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {post.citations.map((c) => (
              <li key={c.identifier}>
                <Link
                  to="/code/$"
                  params={{ _splat: c.identifier }}
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
    </article>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const validate = useServerFn(validateCitations);
  const create = useServerFn(createForumPost);
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
    const res = await validate({ data: { raw: [raw] } });
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
    const res = await create({
      data: {
        title: title.trim(),
        body: body.trim(),
        citations: resolved.map((r) => r.identifier),
        kind,
      },
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
          <label className="citation-tag text-muted-foreground">kind of post</label>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {(["discussion", "feedback", "bug"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "rounded-full px-3 py-1.5 transition " +
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
          <label className="citation-tag text-muted-foreground">title</label>
          <Input
            className="mt-1 h-11 text-base"
            placeholder="Short, factual. e.g. 'How 15 USC 1692g shifted my dispute outcome'"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label className="citation-tag text-muted-foreground">what happened</label>
          <Textarea
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
          <label className="citation-tag text-muted-foreground">attach citations (optional, encouraged)</label>
          <p className="mt-1 text-xs text-foreground/60">
            If your post is about the law, link the section so others can read the source.
            Paste something like <code className="font-mono">15 USC 1692g</code>,{" "}
            <code className="font-mono">29 CFR 1910.95</code>, or a path like{" "}
            <code className="font-mono">/usc/42/1983</code>. Skip this for feedback or bug reports.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
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
