/**
 * SearchSyntax — the "how to search" reference shown on /search.
 *
 * Every operator here is real: plain words, "exact phrase", OR, and -exclude
 * all pass straight through websearch_to_tsquery on the backend; the citation
 * row is handled by the detectCitation fast-path. Each example is a live link —
 * clicking it runs that exact query, so the guide teaches by doing.
 *
 * Collapsible: pass defaultOpen so it greets first-time searchers expanded on
 * the empty landing state, but stays a quiet "Search tips" toggle once results
 * are on screen.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HelpCircle, ChevronDown } from "lucide-react";

type Rule = { example: string; label: string; desc: string };

const RULES: Rule[] = [
  { example: "oath office", label: "all words", desc: "Every word must appear — any order." },
  { example: '"due process of law"', label: "exact phrase", desc: "Quotes keep the words together, in order." },
  { example: "warrant OR subpoena", label: "either word", desc: "A capital OR matches one term or the other." },
  { example: "trust -income", label: "exclude a word", desc: "A minus sign drops results that contain it." },
  { example: "42 USC 1983", label: "jump to a citation", desc: "Lands on the section itself. Also 29 CFR 1910.95, UCC 2-207." },
  { example: '"good faith" estoppel -insurance', label: "combine them", desc: "Phrase + required word + exclusion, all in one query." },
];

export function SearchSyntax({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-card/40 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="citation-tag">how to search</span>
        <span className="text-xs text-foreground/55">
          phrases, <span className="font-mono">OR</span>, <span className="font-mono">-exclude</span>, citations
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/50 p-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RULES.map((r) => (
              <Link
                key={r.example}
                to="/search"
                search={{ q: r.example }}
                className="group flex flex-col gap-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
                title={`Try: ${r.example}`}
              >
                <div className="flex items-center gap-2">
                  <code className="rounded bg-foreground/8 px-1.5 py-0.5 font-mono text-xs text-foreground group-hover:bg-accent/15 group-hover:text-accent">
                    {r.example}
                  </code>
                  <span className="citation-tag text-muted-foreground/70">{r.label}</span>
                </div>
                <span className="text-xs leading-relaxed text-foreground/60">{r.desc}</span>
              </Link>
            ))}
          </div>
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-muted-foreground/60">
            Misspelled a word? We fall back to the closest spelling automatically. Use the source tabs
            (<span className="font-mono">U.S.C.</span>, <span className="font-mono">C.F.R.</span>, …) to limit results to one codebook.
          </p>
        </div>
      )}
    </div>
  );
}
