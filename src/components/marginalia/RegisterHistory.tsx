import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileText, ArrowUp } from "lucide-react";
import { getRegisterHistory, type RegisterHistoryRow } from "@/lib/documents.functions";

// The Federal Register rulemakings that created or amended this CFR part —
// the agency's own reasoning behind the codified text. Lazy-loaded under the
// section, mirroring CasesPanel. Returns null (renders nothing) when there's
// no rule history, so non-CFR or unparsed parts stay clean.
export function RegisterHistory({ identifier }: { identifier: string }) {
  const [rows, setRows] = useState<RegisterHistoryRow[] | null>(null);

  useEffect(() => {
    getRegisterHistory({ data: { identifier } })
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  }, [identifier]);

  if (!rows || rows.length === 0) return null;

  return (
    <details className="group mt-12 rounded-2xl border border-border/60 bg-card">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <FileText className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">Regulatory history</span>
          <span className="citation-tag text-muted-foreground">
            {rows.length} Federal Register rulemaking{rows.length === 1 ? "" : "s"} · the agency's reasoning, newest first
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/40 px-5 pb-6 pt-5">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.identifier}>
              <Link
                to="/code/$"
                params={{ _splat: r.identifier.replace(/^\//, "") }}
                className="group/rule flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/50 px-3.5 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold leading-snug text-foreground group-hover/rule:text-accent">
                    {r.title || r.fr_doc_number}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 citation-tag text-muted-foreground">
                    {r.doc_type && <span>{r.doc_type}</span>}
                    {r.decided && (
                      <>
                        {r.doc_type && <span className="text-foreground/20">·</span>}
                        <span>{r.decided.slice(0, 10)}</span>
                      </>
                    )}
                    <span className="text-foreground/20">·</span>
                    <span className="font-mono text-[12px]">FR Doc. {r.fr_doc_number}</span>
                  </div>
                </div>
                <ArrowUp className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-muted-foreground/40 group-hover/rule:text-accent/60" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 citation-tag text-muted-foreground/70">
          Rulemakings from the Federal Register — the preamble and SUPPLEMENTARY INFORMATION carry the agency's stated reasoning. Read the source.
        </p>
      </div>
    </details>
  );
}
