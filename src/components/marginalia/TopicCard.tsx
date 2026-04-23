import { Link } from "@tanstack/react-router";
import type { Topic } from "@/data/topics";
import { AgencyBadge } from "./AgencyBadge";

export function TopicCard({ topic }: { topic: Topic }) {
  const agencies = Array.from(new Set(topic.citations.map((c) => c.agency)));
  return (
    <Link
      to="/topic/$slug"
      params={{ slug: topic.slug }}
      className="group relative block overflow-hidden rounded-3xl border bg-card p-6 paper-grain shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-warm)]"
    >
      <div className="absolute right-4 top-4 text-3xl opacity-80 transition-transform group-hover:scale-110 group-hover:rotate-6">
        {topic.emoji}
      </div>
      <div className="citation-tag text-muted-foreground">{agencies.length} sources · {topic.citations.length} rules</div>
      <h3 className="mt-2 max-w-[85%] font-display text-2xl font-semibold leading-tight text-foreground">
        {topic.title}
      </h3>
      <p className="mt-3 text-sm italic text-muted-foreground">"{topic.question}"</p>
      <p className="mt-4 text-sm leading-relaxed text-foreground/80">{topic.oneLiner}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {agencies.map((a) => (
          <AgencyBadge key={a} id={a} />
        ))}
      </div>
      <div className="mt-5 flex items-center gap-1 font-display text-sm italic text-accent">
        Open the map
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}