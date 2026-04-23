import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AGENCIES, getTopic, TOPICS, type Citation, type Topic } from "@/data/topics";
import { CitationMap } from "@/components/marginalia/CitationMap";
import { AgencyBadge } from "@/components/marginalia/AgencyBadge";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

function TopicNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="font-display text-4xl">We couldn't find that page.</h1>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        Back to topics
      </Link>
    </div>
  );
}

function TopicError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="font-display text-3xl">Something went sideways.</h1>
      <p className="mt-3 text-muted-foreground">{error.message}</p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-6 rounded-full bg-primary px-5 py-2 text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

export const Route = createFileRoute("/topic/$slug")({
  component: TopicPage,
  notFoundComponent: TopicNotFound,
  errorComponent: TopicError,
  loader: ({ params }) => {
    const topic = getTopic(params.slug);
    if (!topic) throw notFound();
    return { topic };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.topic;
    return {
      meta: [
        { title: t ? `${t.title} · Marginalia` : "Topic · Marginalia" },
        { name: "description", content: t?.oneLiner ?? "" },
        { property: "og:title", content: t?.title ?? "Marginalia" },
        { property: "og:description", content: t?.oneLiner ?? "" },
      ],
    };
  },
});

function TopicPage() {
  const { topic } = Route.useLoaderData() as { topic: Topic };
  const [activeId, setActiveId] = useState<string | null>(topic.citations[0]?.id ?? null);
  const [mode, setMode] = useState<"plain" | "original">("plain");

  const active: Citation | undefined =
    topic.citations.find((c: Citation) => c.id === activeId) ?? topic.citations[0];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <article className="mx-auto max-w-6xl px-6 pt-10">
        <Link to="/" className="font-display text-sm italic text-muted-foreground hover:text-accent">
          ← all topics
        </Link>
        <div className="mt-6 flex items-start gap-4">
          <div className="text-5xl">{topic.emoji}</div>
          <div>
            <div className="citation-tag text-accent">topic</div>
            <h1 className="mt-1 font-display text-5xl font-semibold tracking-tight md:text-6xl">
              {topic.title}
            </h1>
            <p className="mt-3 max-w-2xl font-display text-xl italic text-foreground/70">
              "{topic.question}"
            </p>
          </div>
        </div>
      </article>

      {/* Story + map */}
      <section className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="rounded-3xl border bg-card p-8 paper-grain shadow-[var(--shadow-card)]">
            <div className="citation-tag text-muted-foreground">in plain english</div>
            <p className="mt-3 font-display text-2xl leading-relaxed text-foreground">
              {topic.oneLiner}
            </p>
            <div className="mt-6 space-y-4 text-foreground/85">
              {topic.story.split("\n\n").map((p: string, i: number) => (
                <p key={i} className="leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>

          {topic.glossary.length > 0 && (
            <div className="mt-6 rounded-3xl border bg-card/60 p-6">
              <div className="citation-tag text-muted-foreground">in the margin</div>
              <dl className="mt-3 space-y-3">
                {topic.glossary.map((g: { term: string; meaning: string }) => (
                  <div key={g.term}>
                    <dt className="font-display font-semibold">{g.term}</dt>
                    <dd className="text-sm text-foreground/75">{g.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div>
          <CitationMap topic={topic} activeId={activeId} onSelect={setActiveId} />

          {active && (
            <div className="mt-6 rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AgencyBadge id={active.agency} size="md" />
                  <span className="citation-tag text-muted-foreground">{active.ref}</span>
                </div>
                <div className="inline-flex rounded-full border bg-background p-0.5 text-xs">
                  {(["plain", "original"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded-full px-3 py-1.5 font-display transition-colors ${
                        mode === m
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "plain" ? "Plain English" : "Original"}
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="mt-4 font-display text-2xl font-semibold">{active.title}</h3>
              <p
                className={`mt-3 leading-relaxed ${
                  mode === "original"
                    ? "border-l-4 border-accent/50 bg-paper-deep/40 p-4 font-mono text-sm text-foreground/85"
                    : "text-foreground/85"
                }`}
              >
                {mode === "plain" ? active.plain : active.excerpt}
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                Source: <span className="font-display italic">{AGENCIES[active.agency].name}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Related */}
      {topic.related.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="citation-tag text-muted-foreground">keep reading</div>
          <h2 className="mt-2 font-display text-3xl font-semibold">Threads connected to this one</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {topic.related
              .map((slug: string) => TOPICS.find((t) => t.slug === slug))
              .filter((t): t is Topic => Boolean(t))
              .map((t: Topic) => (
                <Link
                  key={t.slug}
                  to="/topic/$slug"
                  params={{ slug: t.slug }}
                  className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="text-3xl">{t.emoji}</div>
                  <div>
                    <div className="font-display text-lg font-semibold group-hover:text-accent">
                      {t.title}
                    </div>
                    <div className="text-sm text-foreground/70">{t.oneLiner}</div>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}