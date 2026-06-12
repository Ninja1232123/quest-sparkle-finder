import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Search as SearchIcon, X, BookOpen, Network, LayoutGrid, List as ListIcon } from "lucide-react";
import { ResearchShell } from "./ResearchShell";
import { CodebookHero } from "./CodebookHero";
import { sourceMeta, sourceName } from "@/lib/source-groups";
import { codebookForSource, cleanPathForSource } from "@/lib/codebooks";
import { formatGroupCrumb } from "@/lib/label-format";
import type {
  SourceTocNode,
  SourceSummary,
  RegisterYear,
  RegisterDay,
  BillCongress,
  BillRow,
} from "@/lib/documents.functions";
import type { SourceRouteData, TocData, FirehoseData } from "@/lib/source-browser";

// How a browser links back to ITSELF. The same browser renders both at clean
// slugs (/usc) and the generic /code/source/$source, so every internal drill
// link routes to wherever the page actually lives — never hard-coded.
export type LinkSelf = { to: string };

type DocLite = {
  id: string;
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  preview?: string | null;
};

// Some sources (notably UCC) have headings that are just the section
// number — useless on a list. Detect that and fall back to a body snippet.
function isWeakHeading(heading: string | null, section_label: string | null): boolean {
  if (!heading) return true;
  const h = heading.trim();
  if (h.length < 4) return true;
  if (/^[\d.\-§\s]+$/.test(h)) return true;
  if (section_label && h.replace(/\s+/g, "") === section_label.replace(/[§\s]/g, "")) return true;
  return false;
}

export function SourceBrowserPending() {
  // No corpus list available pre-load; render a minimal stand-in shell-shape.
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">Loading…</div>
        <div className="mt-2 h-10 w-2/3 animate-pulse rounded-md bg-muted/60" />
        <div className="mt-8 h-11 w-full animate-pulse rounded-full bg-muted/40" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SourceRouteView({ data, linkSelf }: { data: SourceRouteData; linkSelf: LinkSelf }) {
  if (data.kind === "firehose") return <FirehoseBrowser data={data} linkSelf={linkSelf} />;
  return <SourceBrowser data={data} linkSelf={linkSelf} />;
}

// USC TOC parts arrive chapter-qualified, e.g.
//   "CHAPTER 1— NATIONAL PARKS … · SUBCHAPTER III— NATIONAL PARK FOUNDATION"
// Cluster consecutive same-chapter parts so each chapter shows once as a header
// with its subchapters nested beneath, instead of repeating the chapter on every
// row. Returns null for sources whose parts aren't chapter-structured (CFR/IRM/
// statutes/etc.), so the caller keeps the flat two-column grid.
type TocPart = { label: string; count: number; parent_label: string };
type ChapterRow = { sub: string | null; count: number; parent_label: string };
type ChapterGroup = { chapter: string; rows: ChapterRow[]; total: number };

function groupPartsByChapter(parts: TocPart[]): ChapterGroup[] | null {
  if (!parts.some((p) => /^CHAPTER\b/i.test(p.label))) return null;
  const groups: ChapterGroup[] = [];
  for (const p of parts) {
    const segs = p.label.split(" · ");
    const isChap = /^CHAPTER\b/i.test(segs[0]);
    const chapter = isChap ? segs[0] : p.label;
    const sub = isChap && segs.length > 1 ? segs.slice(1).join(" · ") : null;
    const last = groups[groups.length - 1];
    if (last && last.chapter === chapter) {
      last.rows.push({ sub, count: p.count, parent_label: p.parent_label });
      last.total += p.count;
    } else {
      groups.push({ chapter, rows: [{ sub, count: p.count, parent_label: p.parent_label }], total: p.count });
    }
  }
  return groups;
}

// ── Catalogue bubbles ──────────────────────────────────────────────────────
// One visual language for the browse levels: a milk-white card with a
// per-position accent fade and a solid accent "pull box" carrying the number,
// so a long list reads as a scannable catalogue, not a wall of text. Ported
// from the prototype; reuses tokens already in styles.css (--paper-soft /
// --rule-card / .count-pill / --shadow-*).
function pullToken(label: string): string {
  const m = label.match(/\b(?:PART|CHAPTER|SUBCHAPTER|SUBPART|ARTICLE|TITLE)\s*([0-9]+[A-Za-z]?|[IVXLCDM]+|[A-Z])\b/i);
  if (m) return m[1].toUpperCase();
  const n = label.match(/\b(\d+[A-Za-z]?)\b/);
  return n ? n[1] : "§";
}
function bubbleKind(label: string): string | undefined {
  const m = label.match(/^\s*(part|chapter|subchapter|subpart|article|title)\b/i);
  if (!m) return undefined;
  const k = m[1].toLowerCase();
  return k === "chapter" ? "CH." : k === "subchapter" ? "SUBCH" : k.toUpperCase().slice(0, 6);
}
function cleanBubbleTitle(label: string): string {
  // Strip a leading "TYPE NUM<sep>" locator, leaving the descriptive name.
  // Handles all the separators in the corpus: " — "/" - " (USC, our renames),
  // ". " (Texas/Delaware), and numbers like 12A, 4.2, A, XXIII.
  const stripped = label
    .replace(/^\s*(?:PART|CHAPTER|SUBCHAPTER|SUBPART|ARTICLE|TITLE|SUBTITLE|DIVISION)\s+(?:[0-9]+(?:\.[0-9]+)?[A-Za-z]?|[IVXLCDM]+[A-Za-z]?|[A-Z])(?:\s*[—–-]\s*|\.\s+)/i, "")
    .trim();
  return stripped || label;
}

// Reduce one hierarchy segment to its locator for a breadcrumb, e.g.
// "TITLE 2. DEPARTMENT OF AGRICULTURE" -> "Title 2". Falls back to the cleaned
// name when it isn't a numbered level.
function shortLevel(seg: string): string {
  const m = seg.match(/^\s*(part|chapter|subchapter|subpart|article|title|subtitle|division)\s+([0-9IVXLCDM]+[A-Za-z]?)/i);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2].toUpperCase()}`;
  return cleanBubbleTitle(seg);
}

// Split a multi-level part label (e.g. Texas "TITLE 1. GENERAL PROVISIONS ·
// CHAPTER 1. GENERAL PROVISIONS · SUBCHAPTER A. …") into a readable bubble: the
// DEEPEST segment becomes the title/badge, the rest a small breadcrumb. Single-
// level labels behave exactly as before.
function leveledLabel(raw: string): { kind?: string; token: string; title: string; crumb?: string } {
  const segs = raw.split(" · ");
  const last = segs[segs.length - 1];
  return {
    kind: bubbleKind(last),
    token: pullToken(last),
    title: cleanBubbleTitle(last),
    crumb: segs.length > 1 ? segs.slice(0, -1).map(shortLevel).join(" › ") : undefined,
  };
}

function CatalogueBubble({ kind, token, title, sub, crumb, count, accent, expandable, expanded }: {
  kind?: string;
  token: string;
  title: string;
  sub?: string;
  /** Small breadcrumb of the parent levels, shown above the title. */
  crumb?: string;
  count?: number;
  accent: string;
  index: number;
  expandable?: boolean;
  expanded?: boolean;
}) {
  // When the title is a bare numbered locator with no descriptive name (e.g.
  // "Chapter 88", "Title XXIII" — common in states whose scrape never captured
  // chapter names), the kind-prefixed badge ("CH 88") just repeats the title.
  // Drop the kind so the badge is the number alone: "88" · "Chapter 88".
  const bareNumbered = /^(?:chapter|title|article|division|part|subchapter|subpart)\s+[0-9IVXLCDM]+[A-Za-z]?\.?$/i.test(title.trim());
  const numLabel = bareNumbered ? token : (kind ? `${kind} ${token}` : token);
  return (
    <div className="am-card h-full" style={{ ["--c" as never]: accent }}>
      <div className="am-num">{numLabel}</div>
      {crumb && <div className="am-crumb">{crumb}</div>}
      <div className="am-title">{title}</div>
      {sub && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{sub}</div>}
      <div className="am-meta">
        {count != null ? (
          <span className="am-count">{count.toLocaleString()} sections</span>
        ) : <span />}
        <span className="am-go">{expandable ? (expanded ? "Collapse ▲" : "Browse →") : "Open →"}</span>
      </div>
    </div>
  );
}

// ── Scannable list row ─────────────────────────────────────────────────────
// Dense alternative to the catalogue bubble: number badge | title (+ crumb) |
// count → arrow on a single line. Reads as an index, not a card grid — much
// faster to scan when a title has 200+ chapters or a chapter has 500 sections.
function ListRow({ kind, token, title, sub, crumb, count, accent, expandable, expanded, weight = "normal" }: {
  kind?: string;
  token: string;
  title: string;
  sub?: string;
  crumb?: string;
  count?: number;
  accent: string;
  expandable?: boolean;
  expanded?: boolean;
  /** "header" gets a heavier left accent + bigger title for chapter rows. */
  weight?: "normal" | "header";
}) {
  const bareNumbered = /^(?:chapter|title|article|division|part|subchapter|subpart)\s+[0-9IVXLCDM]+[A-Za-z]?\.?$/i.test(title.trim());
  const numLabel = bareNumbered ? token : (kind ? `${kind} ${token}` : token);
  return (
    <div
      className="group flex items-baseline gap-4 border-b border-border/40 bg-card/50 px-3 py-2.5 transition-colors hover:bg-muted/60"
      style={{ borderLeft: `3px solid ${accent}`, ["--c" as never]: accent }}
    >
      <span
        className={`shrink-0 font-mono ${weight === "header" ? "w-20 text-[12px] font-semibold" : "w-16 text-[11px]"} uppercase tracking-wide text-foreground/70`}
      >
        {numLabel}
      </span>
      <span className="min-w-0 flex-1">
        {crumb && (
          <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">{crumb}</span>
        )}
        <span className={`block ${weight === "header" ? "font-display text-[15px] font-semibold" : "text-sm"} text-foreground leading-snug`}>
          {title}
        </span>
        {sub && <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</span>}
      </span>
      {count != null && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {count.toLocaleString()}
        </span>
      )}
      <span className="shrink-0 font-mono text-[12px] text-muted-foreground/60 group-hover:text-accent">
        {expandable ? (expanded ? "▾" : "▸") : "→"}
      </span>
    </div>
  );
}

type ViewMode = "grid" | "list";
const VIEW_KEY = "selflaw_toc_view_v1";

// A chapter bubble. Simple chapters drill straight to their sections; chapters
// with subchapters reveal them inline on click (subchapters stay off-screen by
// default since they read identically across titles).
function ChapterCell({ cg, accent, index, linkSelf, view }: { cg: ChapterGroup; accent: string; index: number; linkSelf: LinkSelf; view: ViewMode }) {
  const [open, setOpen] = useState(false);
  const simple = cg.rows.length === 1 && cg.rows[0].sub === null;
  const token = pullToken(cg.chapter);
  const title = cleanBubbleTitle(cg.chapter);

  if (simple) {
    return (
      <Link to={linkSelf.to as never} search={{ group: cg.rows[0].parent_label } as never} className="block">
        {view === "list"
          ? <ListRow kind="CH." token={token} title={title} count={cg.total} accent={accent} weight="header" />
          : <CatalogueBubble kind="CH." token={token} title={title} count={cg.total} accent={accent} index={index} />}
      </Link>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="block w-full text-left" aria-expanded={open}>
        {view === "list" ? (
          <ListRow
            kind="CH."
            token={token}
            title={title}
            sub={`${cg.rows.length} subchapters`}
            count={cg.total}
            accent={accent}
            expandable
            expanded={open}
            weight="header"
          />
        ) : (
          <CatalogueBubble
            kind="CH."
            token={token}
            title={title}
            sub={`${cg.rows.length} subchapters`}
            count={cg.total}
            accent={accent}
            index={index}
            expandable
            expanded={open}
          />
        )}
      </button>
      {open && (
        <ul className="mt-2 grid grid-cols-1 gap-1.5 pl-6 sm:grid-cols-2">
          {cg.rows.map((r) => (
            <li key={r.parent_label}>
              <Link
                to={linkSelf.to as never}
                search={{ group: r.parent_label } as never}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-border/50 bg-card px-4 py-2 transition-colors hover:border-foreground/30 hover:bg-muted/50"
              >
                <span className="text-sm text-foreground/80">{r.sub ?? "General provisions"}</span>
                <span className="citation-tag shrink-0 text-muted-foreground">{r.count.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TitleParts({ parts, linkSelf, accent, view }: { parts: TocPart[]; linkSelf: LinkSelf; accent: string; view: ViewMode }) {
  const groups = groupPartsByChapter(parts);

  // No chapter structure (CFR/IRM/statutes/etc.): a flat two-column bubble grid.
  if (!groups) {
    if (view === "list") {
      return (
        <div className="overflow-hidden rounded-xl border border-border/60">
          {parts.map((p) => {
            const L = leveledLabel(p.label);
            return (
              <Link key={p.parent_label} to={linkSelf.to as never} search={{ group: p.parent_label } as never} className="block">
                <ListRow kind={L.kind} token={L.token} title={L.title} crumb={L.crumb} count={p.count} accent={accent} />
              </Link>
            );
          })}
        </div>
      );
    }
    return (
      <div className="toc-grid grid grid-cols-1 items-stretch gap-5 border-t border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((p, i) => {
          const L = leveledLabel(p.label);
          return (
            <Link key={p.parent_label} to={linkSelf.to as never} search={{ group: p.parent_label } as never} className="block h-full">
              <CatalogueBubble kind={L.kind} token={L.token} title={L.title} crumb={L.crumb} count={p.count} accent={accent} index={i} />
            </Link>
          );
        })}
      </div>
    );
  }

  // Chapter-structured (USC): one bubble per chapter, single column so an inline
  // subchapter expansion has room.
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60">
        {groups.map((cg, i) => (
          <ChapterCell key={cg.chapter} cg={cg} accent={accent} index={i} linkSelf={linkSelf} view="list" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2.5 border-t border-border/60 p-4">
      {groups.map((cg, i) => (
        <ChapterCell key={cg.chapter} cg={cg} accent={accent} index={i} linkSelf={linkSelf} view="grid" />
      ))}
    </div>
  );
}

function SourceBrowser({ data, linkSelf }: { data: TocData; linkSelf: LinkSelf }) {
  const { toc, documents, sources, source, group, tg } = data;
  const tocTyped = toc as SourceTocNode[];
  // `group` is the raw parent_label (the drill key); `groupLabel` is its cleaned,
  // de-duplicated display form (e.g. "Title 1 — General Provisions · Part 1 —
  // Definitions" instead of the full noisy breadcrumb).
  const groupLabel = group ? formatGroupCrumb(source, group) : "";
  const displayName = sourceName(source);
  const meta = sourceMeta(source);
  // Show the codebook hero only on a dedicated single-source landing (/usc …);
  // sub-sources of a multi-source codebook (/code/source/irm) keep a plain head.
  const codebook = cleanPathForSource(source) ? codebookForSource(source) : undefined;
  const [filter, setFilter] = useState("");

  // Grid (visual) vs List (scannable). Persisted per-user. Default to list when
  // the level has lots of entries — scanning beats browsing once you're past
  // ~30 cards.
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const setViewPersist = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  // Reset filter when navigating between levels.
  useEffect(() => { setFilter(""); }, [tg, group]);

  // Title node for the tg (intermediate) level.
  const titleNode = tg ? tocTyped.find((t) => t.title_group === tg) : null;
  // Parent title group for back-links from section view.
  const parentTg = group
    ? tocTyped.find((t) => t.parts.some((p) => p.parent_label === group))?.title_group
    : undefined;

  const filteredToc = useMemo<SourceTocNode[]>(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return tocTyped;
    return tocTyped
      .map((t) => ({
        ...t,
        parts: t.parts.filter(
          (p) => p.label.toLowerCase().includes(f) || t.title_group.toLowerCase().includes(f),
        ),
      }))
      .filter((t) => t.parts.length > 0);
  }, [tocTyped, filter]);

  const totalDocs = useMemo(() => tocTyped.reduce((n, t) => n + t.total, 0), [tocTyped]);
  const groupedSections = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!group) return [] as DocLite[];
    if (!f) return documents as DocLite[];
    return (documents as DocLite[]).filter((d) =>
      `${d.heading ?? ""} ${d.preview ?? ""} ${d.section_label ?? ""} ${d.identifier}`.toLowerCase().includes(f),
    );
  }, [documents, group, filter]);

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">this source</div>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.accent }}
            />
            <span className="font-display text-sm font-semibold">{meta.short}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {meta.group}
            </span>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">documents</div>
          <div className="font-display text-2xl font-semibold">{totalDocs.toLocaleString()}</div>
          {meta.tagline && (
            <p className="mt-2 text-xs leading-relaxed text-foreground/65">{meta.tagline}</p>
          )}
        </div>
      </div>

      {group ? (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">in {groupLabel}</div>
          <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-foreground/70">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">entries</div>
            <div className="mt-0.5 font-display text-lg font-semibold text-foreground">
              {(documents as DocLite[]).length.toLocaleString()}
            </div>
            <Link
              to={linkSelf.to as never}
              search={(parentTg ? { tg: parentTg } : {}) as never}
              className="mt-2 inline-block text-[11px] text-accent hover:underline"
            >
              ← back{parentTg ? ` to ${cleanBubbleTitle(parentTg)}` : " to table of contents"}
            </Link>
          </div>
        </div>
      ) : tg && titleNode ? (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">in {cleanBubbleTitle(tg)}</div>
          <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-foreground/70">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">parts</div>
            <div className="mt-0.5 font-display text-lg font-semibold text-foreground">
              {titleNode.parts.length.toLocaleString()}
            </div>
            <Link
              to={linkSelf.to as never}
              className="mt-2 inline-block text-[11px] text-accent hover:underline"
            >
              ← back to all titles
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">structure</div>
          <ul className="space-y-1 text-xs text-foreground/65">
            <li className="flex items-center justify-between">
              <span>titles / parts</span>
              <span className="font-mono">{tocTyped.length.toLocaleString()}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>sections</span>
              <span className="font-mono">{totalDocs.toLocaleString()}</span>
            </li>
          </ul>
        </div>
      )}

      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">soon · here</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card p-3 text-xs text-foreground/65">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Network className="h-3.5 w-3.5" />
            Citation graph
          </div>
          <p className="mt-1 leading-relaxed">
            Open a section and this rail will map every rule that cites it and every authority it depends on — across all codebooks.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-4xl">
      <section>
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">All sources</Link> · {totalDocs.toLocaleString()} documents
          {(tg || group) && (
            <>
              {" · "}
              <Link to={linkSelf.to as never} className="hover:text-foreground">
                Table of contents
              </Link>
            </>
          )}
          {tg && !group && (
            <>
              {" · "}
              <span className="text-foreground/80">{cleanBubbleTitle(tg)}</span>
            </>
          )}
          {group && (
            <>
              {parentTg && (
                <>
                  {" · "}
                  <Link to={linkSelf.to as never} search={{ tg: parentTg } as never} className="hover:text-foreground">
                    {cleanBubbleTitle(parentTg)}
                  </Link>
                </>
              )}
              {" · "}
              <span className="text-foreground/80">{groupLabel}</span>
            </>
          )}
        </div>

        {codebook ? (
          <div className="mt-3">
            <CodebookHero codebook={codebook} sources={sources} />
          </div>
        ) : (
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="ink-underline italic">{displayName}</span>
          </h1>
        )}

        <div className="sticky top-[68px] z-20 -mx-6 mt-8 flex items-center gap-2 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={
                group
                  ? `Filter ${(documents as DocLite[]).length.toLocaleString()} entries in ${groupLabel}…`
                  : tg && titleNode
                    ? `Filter ${titleNode.parts.length} parts in ${cleanBubbleTitle(tg)}…`
                    : `Filter ${toc.length} title${toc.length === 1 ? "" : "s"} — by name or number…`
              }
              className="h-11 w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-10 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-full border border-foreground/15 bg-background/90 p-1 shadow-[var(--shadow-soft)]" role="group" aria-label="Layout">
            <button
              type="button"
              onClick={() => setViewPersist("grid")}
              aria-pressed={view === "grid"}
              title="Card grid"
              className={`flex h-full items-center gap-1.5 rounded-full px-3 font-mono text-[10px] uppercase tracking-wide transition-colors ${view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewPersist("list")}
              aria-pressed={view === "list"}
              title="Compact list"
              className={`flex h-full items-center gap-1.5 rounded-full px-3 font-mono text-[10px] uppercase tracking-wide transition-colors ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Title list — each title is a direct-link bubble (no accordion) */}
        {!group && !tg && (
          view === "list" ? (
            <div className="mt-8 overflow-hidden rounded-xl border border-border/60">
              {filteredToc.length === 0 ? (
                <div className="bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                  Nothing in the table of contents matches "{filter}".
                </div>
              ) : (
                filteredToc.map((t) => {
                  const token = pullToken(t.title_group);
                  const titleClean = cleanBubbleTitle(t.title_group);
                  const kind = bubbleKind(t.title_group)?.replace(/CH\./, "CH") ?? "TITLE";
                  return (
                    <Link key={t.title_group} to={linkSelf.to as never} search={{ tg: t.title_group } as never} className="block">
                      <ListRow kind={kind} token={token} title={titleClean} count={t.total} accent={meta.accent} weight="header" />
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            <div className="toc-grid mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredToc.length === 0 && (
                <div className="col-span-2 rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground lg:col-span-3">
                  Nothing in the table of contents matches "{filter}".
                </div>
              )}
              {filteredToc.map((t, i) => {
                const token = pullToken(t.title_group);
                const titleClean = cleanBubbleTitle(t.title_group);
                const kind = bubbleKind(t.title_group)?.replace(/CH\./, "CH") ?? "TITLE";
                return (
                  <Link
                    key={t.title_group}
                    to={linkSelf.to as never}
                    search={{ tg: t.title_group } as never}
                    className="block"
                  >
                    <CatalogueBubble
                      kind={kind}
                      token={token}
                      title={titleClean}
                      count={t.total}
                      accent={meta.accent}
                      index={i}
                    />
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* Parts/chapters for a selected title group */}
        {tg && !group && (
          <div className="mt-8">
            {!titleNode ? (
              <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                Title not found.
              </div>
            ) : (
              <TitleParts
                parts={
                  filter
                    ? titleNode.parts.filter((p) =>
                        p.label.toLowerCase().includes(filter.trim().toLowerCase()),
                      )
                    : titleNode.parts
                }
                linkSelf={linkSelf}
                accent={meta.accent}
                view={view}
              />
            )}
          </div>
        )}

        {group && (
          <div className="mt-8">
            {groupedSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                {filter ? `No entries in ${groupLabel} match "${filter}".` : `No entries found.`}
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <div className="citation-tag text-accent">{groupLabel}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {groupedSections.length.toLocaleString()} {groupedSections.length === 1 ? "entry" : "entries"}
                  </div>
                </div>
                {view === "list" ? (
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    {groupedSections.map((d) => {
                      const headingText = isWeakHeading(d.heading, d.section_label)
                        ? (d.preview ? (d.preview.length > 120 ? d.preview.slice(0, 120) + "…" : d.preview) : d.heading || "—")
                        : d.heading!;
                      return (
                        <Link
                          key={d.id}
                          to="/code/$"
                          params={{ _splat: d.identifier.replace(/^\//, "") }}
                          className="block"
                        >
                          <ListRow
                            token={d.section_label ?? "§"}
                            title={headingText}
                            accent={meta.accent}
                          />
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2" style={{ ["--c" as never]: meta.accent }}>
                    {groupedSections.map((d) => (
                      <Link
                        key={d.id}
                        to="/code/$"
                        params={{ _splat: d.identifier.replace(/^\//, "") }}
                        className="am-card compact block"
                        style={{ ["--c" as never]: meta.accent }}
                      >
                        <div className="am-num">{d.section_label ?? "§"}</div>
                        <div className="am-title">
                          {isWeakHeading(d.heading, d.section_label)
                            ? (d.preview ? (d.preview.length > 100 ? d.preview.slice(0, 100) + "…" : d.preview) : d.heading || "—")
                            : d.heading}
                        </div>
                        <div className="am-meta">
                          <span />
                          <span className="am-go">Read →</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </ResearchShell>
  );
}

// ---------------------------------------------------------------------------
// Firehose browser — bill & register. A 3-level drill-down driven by search
// params (no flat TOC): year/Congress -> day/bill -> sections.
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  if (!m || !d) return yyyymmdd;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function ordinal(nStr: string): string {
  const n = parseInt(nStr, 10);
  if (!n) return nStr;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// One row in a leaf (a day's notices, or a bill's sections).
function DocRow({ d }: { d: DocLite }) {
  return (
    <li>
      <Link
        to="/code/$"
        params={{ _splat: d.identifier.replace(/^\//, "") }}
        className="flex items-baseline gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="citation-tag w-32 shrink-0 truncate text-muted-foreground">
          {d.section_label ?? ""}
        </span>
        <span className="min-w-0 flex-1">
          {isWeakHeading(d.heading, d.section_label) ? (
            <span className="line-clamp-2 text-sm text-foreground/80">
              {d.preview || d.heading || "—"}
              {d.preview && d.preview.length >= 140 ? "…" : ""}
            </span>
          ) : (
            <span className="font-display text-sm font-semibold">{d.heading}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

// A grid of clickable buckets (years, Congresses, days).
function BucketGrid({
  items,
  linkSelf,
  searchFor,
}: {
  items: { key: string; label: string; sub?: string; count: number }[];
  linkSelf: LinkSelf;
  searchFor: (key: string) => Record<string, unknown>;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <Link
          key={it.key}
          to={linkSelf.to as never}
          search={searchFor(it.key) as never}
          className="group rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
        >
          <div className="font-display text-lg font-semibold">{it.label}</div>
          {it.sub && <div className="text-xs text-muted-foreground">{it.sub}</div>}
          <div className="mt-2 citation-tag text-muted-foreground">
            {it.count.toLocaleString()} {it.count === 1 ? "doc" : "docs"}
          </div>
        </Link>
      ))}
    </div>
  );
}

function FirehoseBrowser({ data, linkSelf }: { data: FirehoseData; linkSelf: LinkSelf }) {
  const { source, sources } = data;
  const navigate = useNavigate();
  const meta = sourceMeta(source);
  const displayName = sourceName(source);
  const codebook = cleanPathForSource(source) ? codebookForSource(source) : undefined;
  const total = sources.find((s: SourceSummary) => s.code === source)?.count ?? 0;

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">this source</div>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.accent }} />
            <span className="font-display text-sm font-semibold">{meta.short}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{meta.group}</span>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">documents</div>
          <div className="font-display text-2xl font-semibold">{total.toLocaleString()}</div>
          {meta.tagline && <p className="mt-2 text-xs leading-relaxed text-foreground/65">{meta.tagline}</p>}
        </div>
      </div>
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">how to browse</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground/65">
          {source === "register"
            ? "Pick a year, then an issue date, to read that day's rules, proposed rules, and notices."
            : "Pick a Congress, then a bill — or type a bill number or keywords to filter."}
        </div>
      </div>
    </div>
  );

  // Breadcrumb trail. Each level links back up.
  const crumbs = (
    <div className="citation-tag text-muted-foreground">
      <Link to="/code" className="hover:text-foreground">All sources</Link>
      {" · "}
      <Link to={linkSelf.to as never} className="hover:text-foreground">{displayName}</Link>
      {data.view === "register-days" && <>{" · "}<span className="text-foreground/80">{data.ry}</span></>}
      {data.view === "register-docs" && (
        <>
          {" · "}
          <Link to={linkSelf.to as never} search={{ ry: Number(data.rd.slice(0, 4)) } as never} className="hover:text-foreground">
            {data.rd.slice(0, 4)}
          </Link>
          {" · "}
          <span className="text-foreground/80">{fmtDay(data.rd)}</span>
        </>
      )}
      {data.view === "bill-list" && <>{" · "}<span className="text-foreground/80">{ordinal(data.bc)} Congress</span></>}
      {data.view === "bill-docs" && (
        <>
          {" · "}
          <Link to={linkSelf.to as never} search={{ bc: data.bk.split(".")[0] } as never} className="hover:text-foreground">
            {ordinal(data.bk.split(".")[0])} Congress
          </Link>
          {" · "}
          <span className="text-foreground/80">this bill</span>
        </>
      )}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-4xl">
      <section>
        {crumbs}

        {codebook && data.view !== "register-docs" && data.view !== "bill-docs" && data.view !== "bill-list" && data.view !== "register-days" ? (
          <div className="mt-3">
            <CodebookHero codebook={codebook} sources={sources} />
          </div>
        ) : (
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="ink-underline italic">{displayName}</span>
          </h1>
        )}

        {data.view === "register-years" && (
          <BucketGrid
            linkSelf={linkSelf}
            items={data.years.map((y: RegisterYear) => ({ key: y.year, label: y.year, count: y.count }))}
            searchFor={(year) => ({ ry: Number(year) })}
          />
        )}
        {data.view === "register-days" && (
          <>
            <p className="mt-3 text-sm text-foreground/70">{data.days.length} issue {data.days.length === 1 ? "day" : "days"} in {data.ry}.</p>
            <BucketGrid
              linkSelf={linkSelf}
              items={data.days.map((d: RegisterDay) => ({ key: d.date, label: fmtDay(d.date), count: d.count }))}
              searchFor={(day) => ({ ry: Number(data.ry), rd: Number(day) })}
            />
          </>
        )}

        {data.view === "bill-congresses" && (
          <BucketGrid
            linkSelf={linkSelf}
            items={data.congresses.map((c: BillCongress) => ({ key: c.congress, label: `${ordinal(c.congress)} Congress`, count: c.count }))}
            searchFor={(congress) => ({ bc: congress })}
          />
        )}
        {data.view === "bill-list" && (
          <BillList
            linkSelf={linkSelf}
            congress={data.bc}
            q={data.bq}
            page={data.bp}
            bills={data.bills}
            hasMore={data.hasMore}
            onSearch={(q) => navigate({ to: linkSelf.to as never, search: { bc: data.bc, bq: q || undefined } as never })}
            onPage={(p) => navigate({ to: linkSelf.to as never, search: { bc: data.bc, bq: data.bq, bp: p || undefined } as never })}
          />
        )}

        {(data.view === "register-docs" || data.view === "bill-docs") && (
          <LeafDocs source={source} docs={data.documents as DocLite[]} />
        )}
      </section>
    </ResearchShell>
  );
}

function LeafDocs({ source, docs }: { source: string; docs: DocLite[] }) {
  // Title the leaf from the first doc's parent_label (date · agency, or the bill line).
  const head = docs[0]?.parent_label ?? "";
  const title = source === "register"
    ? head.split(" · ").slice(1).join(" · ") || head
    : head.split(" — ")[0].split(" · ").slice(1).join(" · ") || head;
  return (
    <div className="mt-8">
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b border-border/60 px-5 py-3">
            {title && <div className="font-display text-sm font-semibold">{title}</div>}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {docs.length.toLocaleString()} {docs.length === 1 ? "section" : "sections"}
            </div>
          </div>
          <ul className="divide-y divide-border/60">
            {docs.map((d) => <DocRow key={d.id} d={d} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function BillList({
  linkSelf,
  congress,
  q,
  page,
  bills,
  hasMore,
  onSearch,
  onPage,
}: {
  linkSelf: LinkSelf;
  congress: string;
  q?: string;
  page: number;
  bills: BillRow[];
  hasMore: boolean;
  onSearch: (q: string) => void;
  onPage: (p: number) => void;
}) {
  const [text, setText] = useState(q ?? "");
  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(text.trim()); }}
        className="sticky top-[68px] z-20 -mx-6 mb-4 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter bills — by number (e.g. H.R. 1) or words in the title…"
            className="h-11 w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-10 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          />
          {text && (
            <button
              type="button"
              onClick={() => { setText(""); onSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          {q ? `No bills in the ${ordinal(congress)} Congress match "${q}".` : "No bills found."}
        </div>
      ) : (
        <ul className="space-y-2">
          {bills.map((b) => {
            const billLine = b.label.split(" · ").slice(1).join(" · ") || b.label;
            return (
              <li key={b.bill_key}>
                <Link
                  to={linkSelf.to as never}
                  search={{ bc: congress, bk: b.bill_key } as never}
                  className="flex items-baseline gap-4 rounded-2xl border bg-card px-5 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="citation-tag w-44 shrink-0 truncate text-muted-foreground">{billLine}</span>
                  <span className="min-w-0 flex-1 font-display text-sm">{b.title ?? "—"}</span>
                  <span className="citation-tag shrink-0 text-muted-foreground">{b.n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPage(page - 1)}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-4 py-2 text-sm disabled:opacity-40 enabled:hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="citation-tag text-muted-foreground">page {page + 1}</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => onPage(page + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-4 py-2 text-sm disabled:opacity-40 enabled:hover:bg-muted"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
