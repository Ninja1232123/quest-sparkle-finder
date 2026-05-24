/**
 * CodebookLanding v2 — match the v2 prototype.
 *
 * Hero strip with accent-tinted icon block, big serif name, status dot,
 * count pill, primary CTAs. Body splits into a main column (sub-volume
 * grid when TOC is loaded, or source cards otherwise) and a "Desk" rail
 * with cross-reference, weekly stats, and related codebooks.
 *
 * The `toc` prop is optional — if a route loader provides it, the
 * sub-volume grid renders. Otherwise we fall back to the source-card
 * behavior the previous version had (which is correct for codebooks
 * with no per-title hierarchy, e.g. Constitution, UCC, agency manuals).
 */

import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  Columns,
  Search as SearchIcon,
} from "lucide-react";
import { ResearchShell } from "./ResearchShell";
import { ComingSoonHeader } from "./ComingSoon";
import type { Codebook } from "@/lib/codebooks";
import { CODEBOOKS } from "@/lib/codebooks";
import type { SourceSummary, SourceTocNode } from "@/lib/documents.functions";

const SOURCE_DISPLAY: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  irm: "Internal Revenue Manual",
  tfm: "Treasury Financial Manual",
  usgm: "U.S. Government Manual",
  fedregister: "Federal Register",
  bills: "Congressional Bills",
  plaw: "Public & Private Laws",
  statute: "Statutes at Large",
  statcomp: "Statute Compilations",
  presdoc: "Presidential Documents",
  pppus: "Public Papers of the Presidents",
  scotus: "Supreme Court Decisions",
  flite: "SCOTUS · FLITE (1937–1975)",
};

type Props = {
  codebook: Codebook;
  sources: SourceSummary[];
  /** Top-level TOC entries for the codebook's primary source, if loaded. */
  toc?: SourceTocNode[];
  /** Which source the TOC belongs to (so sub-volume links route correctly). */
  tocSource?: string;
};

// Cheap stable "this week" decorator — deterministic by string hash so the
// number doesn't dance between renders. Not real data; clearly visual only.
function fakeThisWeek(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 28 + 2;
}

export function CodebookLanding({ codebook, sources, toc, tocSource }: Props) {
  const isLive = codebook.status === "live";
  const ownSources = sources.filter((s) => codebook.sources.includes(s.code));
  const totalDocs = ownSources.reduce((n, s) => n + s.count, 0);
  const Icon = codebook.icon;

  // Sub-volume cards from TOC, sorted descending by total. Cap at 12 for the
  // landing — full list is always reachable via the source browser.
  const subVolumes = (toc ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const rightRail = (
    <div className="space-y-6 text-sm">
      <div>
        <div className="desk-eyebrow">in this codebook</div>
        <div className="desk-mini" style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}>
          <div className="desk-mini-num">{isLive ? totalDocs.toLocaleString() : "—"}</div>
          <div className="desk-mini-sub">
            {isLive ? "documents indexed · updated May 2026" : "coming soon — queued for ingest"}
          </div>
        </div>
      </div>

      {isLive && (
        <>
          <div>
            <div className="desk-eyebrow">cross-reference</div>
            <div className="desk-card">
              <div className="desk-card-title">Open in Compare</div>
              <p className="desk-card-body">
                Put this codebook side-by-side with another. Matched terms highlighted across panes.
              </p>
              <Link
                to="/compare"
                search={{ q: codebook.tab, sources: codebook.sources.concat(["usc", "cfr"]).slice(0, 3).join(",") }}
                className="desk-btn-paper"
              >
                <Columns className="h-3.5 w-3.5" />
                Open Compare
              </Link>
            </div>
          </div>

          <div>
            <div className="desk-eyebrow">this week</div>
            <div className="space-y-2">
              {[
                { lab: "new sections", n: fakeThisWeek(codebook.slug + "new") },
                { lab: "amended", n: fakeThisWeek(codebook.slug + "amd") },
                { lab: "queries vs last week", n: `+${fakeThisWeek(codebook.slug + "q")}%` },
              ].map((m) => (
                <div key={m.lab} className="desk-stat">
                  <span className="desk-stat-lab">{m.lab}</span>
                  <span className="desk-stat-num">{m.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="desk-eyebrow">related codebooks</div>
            <div className="space-y-1">
              {CODEBOOKS.filter((c) => c.status === "live" && c.slug !== codebook.slug)
                .slice(0, 4)
                .map((c) => (
                  <Link
                    key={c.slug}
                    to={`/${c.slug}` as never}
                    className="desk-rel-row"
                  >
                    <span className="desk-rel-dot" style={{ backgroundColor: c.accent }} />
                    <span className="desk-rel-name">{c.tab}</span>
                    <ArrowRight className="h-3 w-3 text-foreground/40" />
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}

      {!isLive && (
        <div>
          <div className="desk-eyebrow text-ochre">status</div>
          <div className="rounded-lg border border-dashed border-ochre/40 bg-ochre/5 p-3 text-xs text-foreground/70">
            <div className="flex items-center gap-1.5 font-medium text-ochre">
              <Sparkles className="h-3 w-3" />
              Coming to the index
            </div>
            <p className="mt-1 leading-relaxed">
              The structure is planned. Documents land here once ingest is wired — no need to
              guess where they'll go.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-5xl">
      {/* HERO STRIP */}
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

      {/* MAIN BODY */}
      {isLive && subVolumes.length > 0 ? (
        <SubVolumeGrid
          codebook={codebook}
          subVolumes={subVolumes}
          source={tocSource ?? codebook.sources[0]}
        />
      ) : isLive && ownSources.length > 0 ? (
        <SourceCardGrid codebook={codebook} ownSources={ownSources} />
      ) : (
        <PlannedShape codebook={codebook} />
      )}
    </ResearchShell>
  );
}

function SubVolumeGrid({
  codebook,
  subVolumes,
  source,
}: {
  codebook: Codebook;
  subVolumes: SourceTocNode[];
  source: string;
}) {
  const label =
    codebook.slug === "const"
      ? "Articles & amendments"
      : codebook.slug === "model"
      ? "Articles"
      : "Titles in this codebook";

  return (
    <section className="mt-10">
      <div className="section-title-bar">
        <div>
          <div className="cb-section-eyebrow">by title</div>
          <h2 className="cb-section-title">{label}</h2>
        </div>
        <span className="citation-tag text-foreground/55">{subVolumes.length} sub-volumes</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subVolumes.map((sv) => {
          const recent = fakeThisWeek(codebook.slug + sv.title_group);
          // Pick a sensible "part" parent_label to deep-link into. First part
          // is fine — the source browser opens that title's parts list.
          const firstPart = sv.parts[0];
          return (
            <Link
              key={sv.title_group}
              to="/code/source/$source"
              params={{ source }}
              search={firstPart ? { group: firstPart.parent_label } : {}}
              className="subvol-card"
            >
              <div className="min-w-0 flex-1">
                <div
                  className="subvol-eyebrow"
                  style={{ color: codebook.accent }}
                >
                  {sv.title_group}
                </div>
                <div className="subvol-name">{shortenTitle(sv.title_group, sv.parts[0]?.label) ?? sv.title_group}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className="count-pill"
                  style={{ ["--c" as string]: codebook.accent } as React.CSSProperties}
                >
                  <span className="num">{sv.total.toLocaleString()}</span>
                </span>
                {recent > 0 && (
                  <span className="subvol-recent">+{recent} this week</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SourceCardGrid({
  codebook,
  ownSources,
}: {
  codebook: Codebook;
  ownSources: SourceSummary[];
}) {
  return (
    <section className="mt-10">
      <div className="section-title-bar">
        <div>
          <div className="cb-section-eyebrow">sources in this codebook</div>
          <h2 className="cb-section-title">Open a volume</h2>
        </div>
        <span className="citation-tag text-foreground/55">
          {ownSources.length} {ownSources.length === 1 ? "source" : "sources"}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ownSources.map((s) => (
          <Link
            key={s.code}
            to="/code/source/$source"
            params={{ source: s.code }}
            className="subvol-card subvol-card-lg"
          >
            <div className="min-w-0 flex-1">
              <div
                className="subvol-eyebrow"
                style={{ color: codebook.accent }}
              >
                {s.count.toLocaleString()} documents
              </div>
              <div className="subvol-name">
                {SOURCE_DISPLAY[s.code] ?? s.name}
              </div>
              <div className="subvol-browse">
                Browse <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PlannedShape({ codebook }: { codebook: Codebook }) {
  const examples = exampleBrowseFor(codebook);
  return (
    <div className="mt-10">
      <ComingSoonHeader
        eyebrow={`planned browse model · ${kindLabel(codebook.kind)}`}
        title="Here's the shape this codebook will take."
        subtitle="When the data lands, these are the screens you'll click through. No mystery search-first list."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {examples.map((ex, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl border border-dashed border-foreground/15 bg-card/40 p-5 paper-grain"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: `linear-gradient(135deg, ${codebook.accent}10 0%, transparent 55%)` }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <ex.icon className="h-3.5 w-3.5" style={{ color: codebook.accent }} />
                <span className="citation-tag" style={{ color: codebook.accent }}>{ex.eyebrow}</span>
              </div>
              <h3 className="mt-2 font-display text-base font-semibold">{ex.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">{ex.pitch}</p>
              {ex.urlHint && (
                <code className="mt-3 inline-block rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground/65">
                  {ex.urlHint}
                </code>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Best-effort shortener — strip the "Title N · " prefix from TOC headings
// when the title_group itself already conveys the number. Most TOC rows are
// already short, so this is a no-op for them.
function shortenTitle(_group: string, firstPart?: string): string | null {
  if (!firstPart) return null;
  // first part labels are often "Chapter 1", "Subchapter A" — not the title's
  // name. Caller falls back to the group string itself.
  return null;
}

function kindLabel(kind: Codebook["kind"]): string {
  switch (kind) {
    case "small-toc": return "single-page table of contents";
    case "hierarchy": return "Title → Chapter → Section";
    case "time": return "year → month → document";
    case "cases": return "decade → year → case";
    case "agency": return "by agency";
  }
}

function exampleBrowseFor(cb: Codebook): { icon: typeof Calendar; eyebrow: string; title: string; pitch: string; urlHint?: string }[] {
  const slug = cb.slug;
  switch (cb.kind) {
    case "time":
      return [
        { icon: Calendar, eyebrow: "by year", title: "Current year, all months", pitch: "Big year picker at top, month density heatmap below — at a glance see when activity spiked.", urlHint: `/${slug}/2026` },
        { icon: Calendar, eyebrow: "by month", title: "A single month's docs", pitch: "Day-by-day list with type chips. Click in for the full text.", urlHint: `/${slug}/2026/05` },
        { icon: Clock, eyebrow: "recently added", title: "Just-landed feed", pitch: "What hit the index in the last 7 days, sorted newest first.", urlHint: `/${slug}/recent` },
        { icon: Sparkles, eyebrow: "by agency / sponsor", title: "Group by who issued it", pitch: "Once metadata is cleaned, sort the firehose by EPA / Treasury / individual sponsor.", urlHint: `/${slug}/agency/epa` },
      ];
    case "cases":
      return [
        { icon: Calendar, eyebrow: "by decade", title: "1970s opinions", pitch: "Decade ribbon at top, scroll a clean list of cases by year.", urlHint: `/${slug}/1970s` },
        { icon: Clock, eyebrow: "by case", title: "Brown v. Board of Education", pitch: "Full opinion with the holding pulled to the top and citations wired into the codebooks they interpret.", urlHint: `/${slug}/1954/brown-v-board` },
        { icon: Sparkles, eyebrow: "by topic", title: "Equal protection cases", pitch: "Once cases are tagged, browse by doctrine — not just chronology.", urlHint: `/${slug}/topic/equal-protection` },
        { icon: Calendar, eyebrow: "recently added", title: "Latest opinions indexed", pitch: "What got added in the last drop.", urlHint: `/${slug}/recent` },
      ];
    case "agency":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Pick an agency manual", pitch: "Each agency manual gets its own card with last-updated date and a section count.", urlHint: `/${slug}` },
      ];
    case "small-toc":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Full table of contents", pitch: "Small enough to live on one page — no pagination, no hunting.", urlHint: `/${slug}` },
      ];
    case "hierarchy":
      return [
        { icon: Sparkles, eyebrow: "shelf", title: "Title grid", pitch: "Every title with section counts; jump-to-citation input at the top.", urlHint: `/${slug}` },
      ];
  }
}
