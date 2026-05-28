/**
 * CodebookHero — the accent-tinted hero strip for a codebook front door.
 *
 * Extracted from CodebookLanding so the full source browser (SourceBrowser)
 * and the multi-source landing (CodebookLanding) render the same chrome.
 * Computes its own totals from the codebook's sources.
 */

import { Link } from "@tanstack/react-router";
import { Columns, Search as SearchIcon } from "lucide-react";
import type { Codebook } from "@/lib/codebooks";
import type { SourceSummary } from "@/lib/documents.functions";

export function CodebookHero({
  codebook,
  sources,
}: {
  codebook: Codebook;
  sources: SourceSummary[];
}) {
  const isLive = codebook.status === "live";
  const ownSources = sources.filter((s) => codebook.sources.includes(s.code));
  const totalDocs = ownSources.reduce((n, s) => n + s.count, 0);
  const Icon = codebook.icon;

  return (
    <section
      className="cb-hero"
      style={{
        ["--c" as string]: codebook.accent,
        backgroundImage: `linear-gradient(135deg, ${codebook.accent}12 0%, transparent 55%)`,
      } as React.CSSProperties}
    >
      <div className="cb-hero-icon">
        <Icon className="h-9 w-9" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="cb-hero-status">
          <span className="cb-hero-status-dot" />
          {isLive ? "now browseable · indexed May 2026" : "coming soon"}
        </div>
        <h1 className="cb-hero-title">{codebook.name}</h1>
        <p className="cb-hero-tag">{codebook.tagline}</p>
        {isLive && totalDocs > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="count-pill lg" style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}>
              <span className="num">{totalDocs.toLocaleString()}</span>
              <span className="lbl">documents</span>
            </span>
            <span className="citation-tag text-foreground/55">
              across {ownSources.length} {ownSources.length === 1 ? "source" : "sources"}
            </span>
          </div>
        )}
      </div>
      {isLive && (
        <div className="cb-hero-actions">
          <Link to="/search" search={{ q: codebook.tab }} className="btn-ink">
            <SearchIcon className="h-3.5 w-3.5" />
            Search this codebook
          </Link>
          <Link
            to="/compare"
            search={{ q: codebook.tab, sources: codebook.sources.concat(["usc", "cfr"]).slice(0, 3).join(",") }}
            className="btn-paper"
          >
            <Columns className="h-3.5 w-3.5" />
            Compare across books
          </Link>
        </div>
      )}
    </section>
  );
}
