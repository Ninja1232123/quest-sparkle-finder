import { Plus, FileText as Summarize, ExternalLink } from "lucide-react";

export type CorpusHit = {
  identifier: string;
  source: string;
  heading: string;
  sectionLabel: string;
  parentLabel: string;
  snippet: string;
};

type Props = {
  hit: CorpusHit;
  onAddToNotes: (hit: CorpusHit) => void;
  onSummarize: (hit: CorpusHit) => void;
};

export function ResultCard({ hit, onAddToNotes, onSummarize }: Props) {
  const url = `/code${hit.identifier}`;
  return (
    <div
      className="group relative rounded-md border bg-card p-3 transition-all hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: "var(--rule-card)" }}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
        <span className="rounded px-1.5 py-0.5" style={{ background: "color-mix(in oklab, var(--brass, #c8a24b) 18%, transparent)" }}>{hit.source}</span>
        {hit.sectionLabel && <span>{hit.sectionLabel}</span>}
        {hit.parentLabel && <span className="opacity-60 truncate">· {hit.parentLabel}</span>}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block text-[14px] font-semibold leading-snug hover:underline"
        style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
      >
        {hit.heading || hit.identifier}
      </a>
      {hit.snippet && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          {hit.snippet}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAddToNotes(hit)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-foreground/5"
          style={{ color: "var(--ink)" }}
        >
          <Plus className="h-3 w-3" /> Add to notes
        </button>
        <button
          type="button"
          onClick={() => onSummarize(hit)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-foreground/5"
          style={{ color: "var(--ink)" }}
        >
          <Summarize className="h-3 w-3" /> Summarize
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors hover:bg-foreground/5"
          style={{ color: "var(--ink-muted)" }}
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      </div>
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div className="rounded-md border bg-card p-3" style={{ borderColor: "var(--rule-card)" }}>
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-foreground/10" />
      <div className="mb-1.5 h-4 w-3/4 animate-pulse rounded bg-foreground/15" />
      <div className="h-3 w-full animate-pulse rounded bg-foreground/10" />
      <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}