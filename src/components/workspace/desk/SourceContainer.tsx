import { Maximize2, Loader2, Sparkles } from "lucide-react";
import type { CorpusHit } from "@/components/workspace/ResultCard";

export type SourceId =
  | "fed-case"
  | "fed-statute"
  | "state-case"
  | "state-statute"
  | "commercial";

export type SourceDef = {
  id: SourceId;
  label: string;
  /** Corpus source filter for searchCorpus; null = search all. */
  corpus: string | null;
  /** Use the opinions index instead of FTS corpus. */
  opinions?: boolean;
  accent: string;
};

export const SOURCE_DEFS: SourceDef[] = [
  { id: "fed-case", label: "Federal case", corpus: null, opinions: true, accent: "var(--cb-scotus, #3d3d5c)" },
  { id: "fed-statute", label: "Federal statute", corpus: "usc", accent: "var(--cb-usc, #0a1f44)" },
  { id: "state-case", label: "State case", corpus: null, accent: "var(--cb-states, #4a6741)" },
  { id: "state-statute", label: "State statute", corpus: null, accent: "var(--sage-deep)" },
  { id: "commercial", label: "Commercial", corpus: "ucc", accent: "var(--cb-statutes, #6b3a2a)" },
];

export type ContainerState = {
  query: string;
  loading: boolean;
  error: string | null;
  hits: CorpusHit[] | null;
};

type Props = {
  def: SourceDef;
  state: ContainerState;
  onExpand: () => void;
  onRunDeepDive: () => void;
};

export function SourceContainer({ def, state, onExpand, onRunDeepDive }: Props) {
  const count = state.hits?.length ?? 0;
  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--rule-card)", borderLeft: `3px solid ${def.accent}` }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--rule-card)" }}>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
            {def.label}
          </div>
          <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
            {state.loading ? "Searching…" : count > 0 ? `${count} result${count === 1 ? "" : "s"}` : "Empty"}
          </div>
        </div>
        <button
          type="button"
          onClick={onExpand}
          title="Expand to read"
          className="grid h-7 w-7 shrink-0 place-items-center rounded transition-colors hover:bg-foreground/5"
          style={{ color: "var(--ink)" }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.loading && (
          <div className="flex items-center gap-2 px-1 py-3 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deep-diving the corpus…
          </div>
        )}
        {!state.loading && state.error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{state.error}</div>
        )}
        {!state.loading && !state.error && (state.hits === null || count === 0) && (
          <button
            type="button"
            onClick={onRunDeepDive}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-4 text-[11px] transition-colors hover:bg-foreground/5"
            style={{ borderColor: "var(--rule-card)", color: "var(--ink-muted)" }}
          >
            <Sparkles className="h-3.5 w-3.5" /> {state.hits === null ? "Run deep dive" : "No hits — try again"}
          </button>
        )}
        {!state.loading && !state.error && state.hits && count > 0 && (
          <ul className="space-y-1.5">
            {state.hits.slice(0, 5).map((h) => (
              <li key={h.identifier}>
                <button
                  type="button"
                  onClick={onExpand}
                  className="w-full rounded border bg-paper-soft px-2 py-1.5 text-left transition-colors hover:border-foreground/30"
                  style={{ borderColor: "var(--rule-card)" }}
                >
                  <div className="truncate text-[11px] font-medium" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
                    {h.heading || h.identifier}
                  </div>
                  {h.sectionLabel && (
                    <div className="truncate text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                      {h.sectionLabel}
                    </div>
                  )}
                </button>
              </li>
            ))}
            {count > 5 && (
              <li>
                <button type="button" onClick={onExpand} className="w-full px-2 py-1 text-center text-[10px] underline decoration-dotted underline-offset-2" style={{ color: "var(--ink-muted)" }}>
                  +{count - 5} more — open to read
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
