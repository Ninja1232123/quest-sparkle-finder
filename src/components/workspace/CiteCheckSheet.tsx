import { X, CheckCircle2, AlertCircle, CircleDashed } from "lucide-react";

export type CiteCheckResult = {
  raw: string;
  identifier: string;
  citation: string;
  resolves: boolean;
  pinned: boolean;
};

type Props = {
  open: boolean;
  loading: boolean;
  results: CiteCheckResult[] | null;
  error: string | null;
  onClose: () => void;
  onPin: (r: CiteCheckResult) => void;
};

export function CiteCheckSheet({ open, loading, results, error, onClose, onPin }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l shadow-2xl" style={{ background: "var(--paper)", borderColor: "var(--brass, #c8a24b)" }}>
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
        <div>
          <div className="text-[12px] tracking-[0.25em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>Cite check</div>
          <div className="text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>Citations in your draft</div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-foreground/5"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {loading && <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Scanning…</div>}
        {error && <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
        {!loading && results && results.length === 0 && (
          <div className="text-xs" style={{ color: "var(--ink-muted)" }}>No USC or CFR citations detected. Add a section like <span className="font-mono">42 U.S.C. § 1983</span> and re-check.</div>
        )}
        {!loading && results && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.identifier} className="rounded border p-2" style={{ borderColor: "var(--rule-card)" }}>
                <div className="flex items-start gap-2">
                  <StatusIcon r={r} />
                  <div className="min-w-0 flex-1">
                    <a href={`/code/${r.identifier}`} target="_blank" rel="noreferrer" className="block text-sm font-semibold hover:underline" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                      {r.citation}
                    </a>
                    <div className="font-mono text-[12px]" style={{ color: "var(--ink-muted)" }}>as written: "{r.raw}"</div>
                    <div className="mt-0.5 text-[12px]" style={{ color: r.resolves ? "var(--ink-muted)" : "#a8413a" }}>
                      {r.resolves
                        ? r.pinned ? "Resolves · pinned to your case" : "Resolves · not on your board"
                        : "Does not resolve in the corpus — verify the citation"}
                    </div>
                    {r.resolves && !r.pinned && (
                      <button type="button" onClick={() => onPin(r)} className="mt-1.5 rounded px-2 py-0.5 text-[12px] hover:bg-foreground/5" style={{ color: "var(--ink)", border: "1px solid var(--rule-card)" }}>
                        Pin to case
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ r }: { r: CiteCheckResult }) {
  if (!r.resolves) return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#a8413a" }} />;
  if (r.pinned) return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#3f7d4e" }} />;
  return <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brass, #c8a24b)" }} />;
}