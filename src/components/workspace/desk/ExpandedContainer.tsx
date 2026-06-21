import { useEffect, useRef, useState } from "react";
import { X, Search, ExternalLink } from "lucide-react";
import type { CorpusHit } from "@/components/workspace/ResultCard";
import { ResultSkeleton } from "@/components/workspace/ResultCard";
import { BUCKETS, type BucketId } from "./CompileBuckets";
import type { SourceDef, ContainerState } from "./SourceContainer";

type Props = {
  def: SourceDef;
  state: ContainerState;
  onClose: () => void;
  onSearch: (q: string) => void;
  /** Pull a manually-selected snippet into a compile bucket. */
  onPullSnippet: (args: { bucket: BucketId; text: string; hit: CorpusHit }) => void;
};

export function ExpandedContainer({ def, state, onClose, onSearch, onPullSnippet }: Props) {
  const [q, setQ] = useState(state.query);
  const [selection, setSelection] = useState<{ text: string; hit: CorpusHit } | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Capture the active text selection within a result card.
  const captureSelection = (hit: CorpusHit) => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length >= 8) {
      setSelection({ text, hit });
    } else {
      setSelection(null);
    }
  };

  const send = (bucket: BucketId) => {
    if (!selection) return;
    onPullSnippet({ bucket, text: selection.text, hit: selection.hit });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col rounded-lg border bg-paper shadow-2xl" style={{ borderColor: def.accent }}>
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: def.accent }} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
            {def.label}
          </div>
          <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
            Select any sentence to pull it into a compile bucket
          </div>
        </div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded transition-colors hover:bg-foreground/5" style={{ color: "var(--ink)" }} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) onSearch(q.trim()); }}
        className="shrink-0 border-b px-4 py-2"
        style={{ borderColor: "var(--rule-card)" }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Refine ${def.label.toLowerCase()} search…`}
            className="w-full rounded-md border bg-card py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-foreground/30"
            style={{ borderColor: "var(--rule-card)" }}
          />
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" onMouseUp={() => { /* selection handled per-card */ }}>
        {state.loading && <div className="space-y-3"><ResultSkeleton /><ResultSkeleton /><ResultSkeleton /></div>}
        {!state.loading && state.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>
        )}
        {!state.loading && !state.error && state.hits && state.hits.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "var(--ink-muted)" }}>No results in this container yet.</div>
        )}
        {!state.loading && !state.error && state.hits && state.hits.length > 0 && (
          <div className="space-y-3">
            {state.hits.map((h) => (
              <article
                key={h.identifier}
                onMouseUp={() => captureSelection(h)}
                className="rounded-md border bg-card p-3"
                style={{ borderColor: "var(--rule-card)" }}
              >
                <div className="mb-1 flex items-center gap-2 text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  <span className="rounded px-1.5 py-0.5" style={{ background: "color-mix(in oklab, var(--brass) 18%, transparent)" }}>{h.source}</span>
                  {h.sectionLabel && <span>{h.sectionLabel}</span>}
                  {h.parentLabel && <span className="truncate opacity-60">· {h.parentLabel}</span>}
                  <a href={`/code/${h.identifier}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </div>
                <h3 className="text-[15px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                  {h.heading || h.identifier}
                </h3>
                {h.snippet && (
                  <p className="statute-prose mt-1.5 select-text text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
                    {h.snippet}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Selection action bar — pull the exact text into a bucket. */}
      {selection && (
        <div
          ref={popRef}
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: def.accent, background: "var(--paper-tint)" }}
        >
          <div className="mb-2 line-clamp-2 text-[12px] italic" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
            &ldquo;{selection.text}&rdquo;
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>Pull to →</span>
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => send(b.id)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-transform hover:-translate-y-px"
                style={{ borderColor: b.accent, color: "var(--ink)", background: b.wash }}
              >
                <b.icon className="h-3 w-3" style={{ color: b.accent }} />
                {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
              className="ml-auto text-[12px] underline decoration-dotted underline-offset-2"
              style={{ color: "var(--ink-muted)" }}
            >
              clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
