import { Link } from "@tanstack/react-router";
import type { Topic } from "@/data/topics";
import { AgencyBadge } from "./AgencyBadge";

export function TopicCard({ topic }: { topic: Topic }) {
  const agencies = Array.from(new Set(topic.citations.map((c) => c.agency)));
  return (
    <Link
      to="/topic/$slug"
      params={{ slug: topic.slug }}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 paper-grain shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[var(--shadow-warm)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="citation-tag text-muted-foreground">
          {agencies.length} source{agencies.length === 1 ? "" : "s"} · {topic.citations.length} rules
        </div>
        <div className="font-display text-base text-muted-foreground/70">{topic.emoji}</div>
      </div>
      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-foreground">
        {topic.title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-foreground/80">{topic.oneLiner}</p>
      <p className="mt-3 font-display text-sm italic text-muted-foreground">— {topic.question}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {agencies.map((a) => (
          <AgencyBadge key={a} id={a} />
        ))}
      </div>
      <div className="mt-5 flex items-center gap-1 font-display text-sm italic text-accent">
        Read & trace citations
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}