import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, listSources, type DocCitationRow, type IncomingCitation, type InboundBySource } from "@/lib/documents.functions";
import { SectionCitationGraph, type GraphTrace } from "@/components/marginalia/SectionCitationGraph";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Highlighter, Landmark, Link as LinkIcon, Minus, Network, PenLine, Plus, Scale, X } from "lucide-react";
import { fetchSectionCases, courtDisplay, type ClCase } from "@/lib/court-cases";
import { renderDecorated } from "@/lib/auto-link-citations";
import { segmentBody, splitParagraphs, citationSpans, operativeParagraphs, subsectionBlocks, type BodySegment, type LegalPara } from "@/lib/legal-structure";
import { SendToWorkspaceButton } from "@/components/workspace/SendToWorkspaceButton";
import { STATE_NAMES, sourceName } from "@/lib/source-groups";
import { formatGroupCrumb } from "@/lib/label-format";
import { docSeo, SITE_BRAND } from "@/lib/doc-seo";
import { useMarginalia, useCases, type CaseRecord, type NoteRecord } from "@/lib/casebook";

// Body rendering lives in @/lib/legal-structure (segmentBody / splitParagraphs)
// and @/lib/auto-link-citations (renderDecorated). Both work in original
// body_text offsets so citation_edges spans stay valid. See CITATION_GAMEPLAN.md.

const LEVEL_INDENT = ["", "pl-5", "pl-10", "pl-16"] as const;

// ── Defined-terms extractor ──────────────────────────────────────────────────
// Scans body_text for "term" means / is defined as / refers to patterns common
// in CFR/USC definitions sections. Returns a map of lowercased term → excerpt.
function extractDefinitions(text: string): Map<string, string> {
  const defs = new Map<string, string>();
  // Match both straight and curly quotes; allow optional "the term" prefix.
  const re =
    /(?:the\s+term\s+)?["“‘]([A-Za-z][^"“”‘’]{1,80})["”’]\s+(?:means?|is\s+defined\s+as|refers?\s+to|includes?)\s+([^.;]{10,400}[.;]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const term = m[1].trim();
    const defn = m[2].trim();
    if (term.length >= 2 && !defs.has(term.toLowerCase())) {
      defs.set(term.toLowerCase(), defn.length > 220 ? defn.slice(0, 220) + "…" : defn);
    }
  }
  return defs;
}

function DefinitionsPanel({ text }: { text: string }) {
  const defs = useMemo(() => extractDefinitions(text), [text]);
  const [open, setOpen] = useState(false);
  if (defs.size === 0) return null;
  const entries = Array.from(defs.entries()).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card paper-grain">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="citation-tag text-muted-foreground">Definitions in this section</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {defs.size}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <dl className="space-y-3">
            {entries.map(([term, defn]) => (
              <div key={term}>
                <dt className="font-display text-sm font-semibold capitalize">{term}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-foreground/65">{defn}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function buildMarkRe(q?: string): RegExp | null {
  if (!q?.trim()) return null;
  const terms = q.trim().split(/\s+/).filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return terms.length ? new RegExp(`(${terms.join("|")})`, "ig") : null;
}

// ── Reader marginalia → cases ───────────────────────────────────────────────
// The note store + cases live in @/lib/casebook (device-local localStorage,
// nothing leaves the browser). A margin note can tag itself to a named CASE by
// typing "@" in the composer; the citation it was written beside rides along
// automatically. Those notes assemble into a drag-orderable draft on /cases.
// Hydration-safe (loads after mount) so SSR renders the statute clean.

// The composer: jot a note, and type "@" to tag it to a case (or start one).
// `selected` is the set of case ids this note belongs to.
function MarginComposer({ initial, initialCases, cases, onSave, onCreateCase, onCancel }: {
  initial: string;
  initialCases: string[];
  cases: CaseRecord[];
  onSave: (text: string, caseIds: string[]) => void;
  onCreateCase: (name: string) => string;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState<string[]>(initialCases);
  const [menu, setMenu] = useState(false);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, []);

  const byId = (id: string) => cases.find((c) => c.id === id);
  const tag = (id: string) => {
    setSelected((s) => (s.includes(id) ? s : [...s, id]));
    setMenu(false);
    setNewName("");
    ref.current?.focus();
  };
  const untag = (id: string) => setSelected((s) => s.filter((x) => x !== id));
  const createAndTag = () => {
    const n = newName.trim();
    if (!n) return;
    tag(onCreateCase(n));
  };

  return (
    <div className="relative rounded-xl border-[1.5px] border-ochre bg-card/95 px-3 py-2.5 shadow-[var(--shadow-card)]">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => untag(id)}
              title="Remove from this case"
              className="inline-flex items-center gap-1 rounded-full border border-ochre/55 bg-ochre/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-foreground/80 hover:bg-ochre/30"
            >
              <Scale className="h-3 w-3" /> {byId(id)?.name ?? "case"} <X className="h-2.5 w-2.5 opacity-60" />
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "@") { setMenu(true); }
          else if (e.key === "Enter" && !e.shiftKey && !menu) { e.preventDefault(); onSave(draft, selected); }
          else if (e.key === "Escape") { e.preventDefault(); if (menu) setMenu(false); else onCancel(); }
        }}
        rows={3}
        placeholder="in your own words…  type @ to file it under a case"
        title="Enter to save · @ to tag a case · Esc to cancel"
        className="w-full resize-y border-0 bg-transparent font-hand text-[18px] leading-snug text-foreground outline-none placeholder:text-foreground/30"
      />

      {menu && (
        <div className="absolute inset-x-2 top-[3.2rem] z-10 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">File under a case</div>
          <div className="max-h-44 overflow-y-auto">
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => tag(c.id)}
                disabled={selected.includes(c.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/60 disabled:opacity-40"
              >
                <Scale className="h-3.5 w-3.5 text-ochre" />
                <span className="font-display text-[13px] text-foreground">{c.name}</span>
                <span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground">{c.items.length} notes</span>
              </button>
            ))}
            {cases.length === 0 && (
              <div className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">No cases yet — name one below.</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 border-t border-border/60 px-2 py-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createAndTag(); } if (e.key === "Escape") { e.preventDefault(); setMenu(false); } }}
              placeholder="new case name…"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 font-display text-[13px] outline-none focus:border-ochre"
            />
            <button type="button" onClick={createAndTag} className="shrink-0 rounded-md bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-background hover:opacity-90">
              + Case
            </button>
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">@ files a case · ⏎ saves</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onCancel} className="rounded-full px-2 py-0.5 font-display text-[11px] font-semibold text-foreground/45 hover:text-foreground">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(draft, selected)} className="rounded-full bg-foreground px-2.5 py-0.5 font-display text-[11px] font-semibold text-background hover:opacity-90">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// `tone` distinguishes where the note lives: "ochre" is the desktop margin rail
// (the gold reserved for marks); "sage" is the stacked Desk on phones/tablets,
// a cooler green so the note reads as clearly its own thing away from the gutter.
function MarginNote({ text, noteCases, onEdit, onDelete, tone = "ochre" }: { text: string; noteCases: CaseRecord[]; onEdit: () => void; onDelete: () => void; tone?: "ochre" | "sage" }) {
  const accent = tone === "sage"
    ? { rail: "border-sage", wash: "bg-sage/[0.09]", tagBorder: "border-sage/55", tagBg: "bg-sage/20 hover:bg-sage/30" }
    : { rail: "border-ochre", wash: "bg-ochre/[0.07]", tagBorder: "border-ochre/55", tagBg: "bg-ochre/20 hover:bg-ochre/30" };
  return (
    <div className={`group/note relative rounded-lg border-l-[3px] ${accent.rail} ${accent.wash} px-3 py-2.5 shadow-[var(--shadow-card)]`}>
      {noteCases.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {noteCases.map((c) => (
            <Link
              key={c.id}
              to="/cases/$id"
              params={{ id: c.id }}
              className={`inline-flex items-center gap-1 rounded-full border ${accent.tagBorder} ${accent.tagBg} px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-foreground/75`}
            >
              <Scale className="h-2.5 w-2.5" /> {c.name}
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        title="Click to edit"
        className="block cursor-text text-left font-hand text-[20px] leading-snug text-foreground hover:text-foreground"
      >
        {text}
      </button>
      <div className="mt-1.5 flex items-center gap-3">
        {noteCases.length > 0 && (
          <span className="font-mono text-[9px] uppercase tracking-wide text-terracotta/80">filed · citation attached</span>
        )}
        {/* Touch has no hover: keep edit/delete visible below lg, hover-reveal on desktop. */}
        <div className="ml-auto flex gap-3 transition lg:opacity-0 lg:group-hover/note:opacity-100">
          <button type="button" onClick={onEdit} className="font-mono text-[10px] uppercase tracking-wider text-foreground/40 hover:text-foreground">edit</button>
          <button type="button" onClick={onDelete} className="font-mono text-[10px] uppercase tracking-wider text-destructive/70 hover:text-destructive">delete</button>
        </div>
      </div>
    </div>
  );
}

// One operative paragraph, read at the full reading measure. The prose NEVER
// moves when you write: a note never renders inline in the column — it lives in
// the Desk (the margin rail at lg+, or the stacked Desk below the article on
// narrow widths). Click a paragraph to start/continue its margin note; citations
// inside still navigate, and selecting text still works. The left rule is always
// present (transparent) so toggling a note tints it without shifting the words.
function Para({ id, body, p, citations, markRe, hasNote, selected, hydrated, zebra, onCompose }: {
  id: string;
  body: string;
  p: LegalPara;
  citations: DocCitationRow[];
  markRe: RegExp | null;
  hasNote: boolean;
  selected: boolean;
  hydrated: boolean;
  zebra?: boolean;
  onCompose: () => void;
}) {
  const handleClick = (e: ReactMouseEvent) => {
    if (!hydrated) return;
    if ((e.target as HTMLElement).closest("a")) return; // let citations navigate
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && !sel.isCollapsed) return; // don't hijack a text selection
    onCompose();
  };
  const tone = hasNote
    ? "border-ochre/70 bg-gradient-to-r from-ochre/10 to-transparent"
    : selected
      ? "border-ochre/45"
      : "border-transparent";
  return (
    <div
      id={id}
      className={`group/para scroll-mt-24 rounded-md transition-colors ${
        zebra ? "para-zebra" : ""
      }`}
    >
      <div className={`flex gap-3 ${LEVEL_INDENT[p.level]}`}>
        {p.label && <span className="ci-pill">{p.label}</span>}
        <span
          onClick={handleClick}
          title={hydrated ? "Click to write in the margin" : undefined}
          className={`${p.label ? "flex-1" : "block"} -ml-3 border-l-2 pl-3 transition-colors ${tone} ${
            hydrated && !hasNote && !selected ? "hover:border-ochre/25" : ""
          }`}
        >
          {renderDecorated(body, p.start, p.end, citations, markRe)}
        </span>
      </div>
    </div>
  );
}

// Rough rendered height of a note card, used for first-paint stacking before we
// measure the real DOM heights. The Desk rail is a ~20rem strip pinned to the
// right margin (~36 chars/line); real heights are measured after paint anyway.
function estimateNoteH(text: string) {
  const lines = Math.max(2, Math.ceil(text.length / 36));
  return 26 + lines * 28;
}

const MARK_STEP = 640; // px between faint ruling marks down the margin

// The dedicated marginalia margin (lg+). A ruled notebook gutter: click anywhere
// to start a note anchored to the nearest paragraph; saved notes float at their
// paragraph's height and stack downward so they never overlap, with a hairline
// connector back to the anchor when a note gets pushed down. `anchors[i]` is the
// measured Y (px, relative to the body wrapper) of paragraph i.
function MarginaliaRail({ anchors, height, notes, cases, casesForIdx, composing, onCompose, onSave, onCreateCase, onCancel, onDelete }: {
  anchors: number[];
  height: number;
  notes: Record<string, NoteRecord>;
  cases: CaseRecord[];
  casesForIdx: (idx: number) => CaseRecord[];
  composing: number | null;
  onCompose: (idx: number) => void;
  onSave: (idx: number, text: string, caseIds: string[]) => void;
  onCreateCase: (name: string) => string;
  onCancel: () => void;
  onDelete: (idx: number) => void;
}) {
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Cards to lay out: every saved note plus the one being composed.
  const items = useMemo(() => {
    const set = new Set<number>();
    for (const k of Object.keys(notes)) set.add(Number(k));
    if (composing != null) set.add(composing);
    return [...set]
      .filter((i) => i < anchors.length)
      .map((i) => ({ idx: i, y: anchors[i] ?? 0 }))
      .sort((a, b) => a.y - b.y);
  }, [notes, composing, anchors]);

  const itemsKey = items.map((it) => it.idx).join(",");

  // Measure real card heights after render so stacking is exact. Only commits on
  // change, so it settles in one extra frame instead of looping.
  useEffect(() => {
    const next: Record<number, number> = {};
    let changed = false;
    for (const { idx } of items) {
      const el = cardRefs.current[idx];
      const h = el ? el.offsetHeight : 0;
      next[idx] = h;
      if (h !== heights[idx]) changed = true;
    }
    if (changed) setHeights(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, composing, notes]);

  // Stack: a card sits at its anchor unless that would overlap the one above it.
  const GAP = 14;
  const placed: { idx: number; y: number; top: number }[] = [];
  let cursor = -Infinity;
  for (const it of items) {
    const h = heights[it.idx] ?? estimateNoteH(notes[it.idx]?.text ?? "");
    const top = Math.max(it.y, cursor + GAP);
    placed.push({ idx: it.idx, y: it.y, top });
    cursor = top + h;
  }

  const nearest = (y: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const d = Math.abs((anchors[i] ?? 0) - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
  const railY = (e: ReactMouseEvent) => e.clientY - e.currentTarget.getBoundingClientRect().top;

  const marks: number[] = [];
  for (let y = MARK_STEP; y < height; y += MARK_STEP) marks.push(y);

  const empty = items.length === 0;

  return (
    <div
      className="absolute top-0 hidden border-l border-border/60 bg-muted/20 lg:block"
      style={{ left: "100%", marginLeft: "2rem", width: "20rem", minHeight: height }}
      onMouseMove={(e) => setHoverY(railY(e))}
      onMouseLeave={() => setHoverY(null)}
      onClick={(e) => { if (e.target === e.currentTarget) onCompose(nearest(railY(e))); }}
    >
      {/* faint ruling ticks down the desk's binding edge */}
      {marks.map((y) => (
        <div key={`m-${y}`} className="pointer-events-none absolute left-0 h-px w-3 bg-border/70" style={{ top: y }} />
      ))}

      {/* empty desk → a quiet prompt card so the column reads as "the desk,"
          not dead space. pointer-events-none so a click still starts a note. */}
      {empty && (
        <div className="pointer-events-none absolute left-5 right-2 top-3">
          <div className="desk-card border-dashed">
            <div className="desk-card-title flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5 text-ochre" /> Your desk
            </div>
            <p className="desk-card-body">
              Click anywhere down this margin to pin a note beside the line it belongs to.
              Type <span className="font-mono text-ochre">@</span> to file it under a case — the citation rides along.
            </p>
          </div>
        </div>
      )}

      {/* click-to-add hint following the cursor */}
      {hoverY != null && composing == null && (
        <div
          className="pointer-events-none absolute left-0 flex -translate-y-1/2 items-center gap-1.5 pl-3 font-hand text-[16px] text-ochre/70"
          style={{ top: hoverY }}
        >
          <PenLine className="h-3.5 w-3.5" /> note in the margin
        </div>
      )}

      {/* connector hairline + anchor dot for each note */}
      {placed.map(({ idx, y, top }) => (
        <div key={`a-${idx}`} className="pointer-events-none">
          {top > y + 1 && (
            <div className="absolute left-0 w-px bg-ochre/40" style={{ top: y, height: top - y }} />
          )}
          <div className="absolute left-0 h-1.5 w-1.5 -translate-x-[3px] -translate-y-1/2 rounded-full bg-ochre" style={{ top: y }} />
        </div>
      ))}

      {/* the note cards / active composer */}
      {placed.map(({ idx, top }) => (
        <div
          key={`n-${idx}`}
          ref={(el) => { cardRefs.current[idx] = el; }}
          className="absolute left-3 right-0 transition-[top] duration-150 ease-out"
          style={{ top }}
          onClick={(e) => e.stopPropagation()}
        >
          {composing === idx ? (
            <MarginComposer
              initial={notes[idx]?.text ?? ""}
              initialCases={casesForIdx(idx).map((c) => c.id)}
              cases={cases}
              onSave={(t, ids) => onSave(idx, t, ids)}
              onCreateCase={onCreateCase}
              onCancel={onCancel}
            />
          ) : (
            <MarginNote text={notes[idx]?.text ?? ""} noteCases={casesForIdx(idx)} onEdit={() => onCompose(idx)} onDelete={() => onDelete(idx)} />
          )}
        </div>
      ))}
    </div>
  );
}

// The Desk on narrow widths (< lg, where a side rail would crush the reading
// measure): the same notes, stacked in a clean column BELOW the article rather
// than floating beside the text. The reading flow above is never disturbed —
// composing happens here, not inline in the prose. Clicking a paragraph up top
// opens its composer here and scrolls it into view.
function DeskStacked({ notes, composing, cases, casesForIdx, onCompose, onSave, onCreateCase, onCancel, onDelete }: {
  notes: Record<string, NoteRecord>;
  composing: number | null;
  cases: CaseRecord[];
  casesForIdx: (idx: number) => CaseRecord[];
  onCompose: (idx: number) => void;
  onSave: (idx: number, text: string, caseIds: string[]) => void;
  onCreateCase: (name: string) => string;
  onCancel: () => void;
  onDelete: (idx: number) => void;
}) {
  const indices = useMemo(() => {
    const set = new Set<number>();
    for (const k of Object.keys(notes)) set.add(Number(k));
    if (composing != null) set.add(composing);
    return [...set].sort((a, b) => a - b);
  }, [notes, composing]);

  // When a paragraph is tapped on a narrow screen, bring its composer into view.
  useEffect(() => {
    if (composing == null || typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return; // rail handles lg+
    document.getElementById(`desk-note-${composing}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [composing]);

  return (
    <div className="mt-10 border-t border-border/50 pt-5 lg:hidden">
      <div className="desk-eyebrow">the desk</div>
      {indices.length === 0 ? (
        <p className="font-hand text-[17px] leading-snug text-foreground/45">
          Click any paragraph above to write a note beside it. Type <span className="font-mono text-ochre">@</span> to file it under a case — the citation rides along.
        </p>
      ) : (
        <div className="space-y-3">
          {indices.map((i) => (
            <div key={i} id={`desk-note-${i}`} className="scroll-mt-24">
              {composing === i ? (
                <MarginComposer
                  initial={notes[i]?.text ?? ""}
                  initialCases={casesForIdx(i).map((c) => c.id)}
                  cases={cases}
                  onSave={(t, ids) => onSave(i, t, ids)}
                  onCreateCase={onCreateCase}
                  onCancel={onCancel}
                />
              ) : (
                <MarginNote text={notes[i]?.text ?? ""} noteCases={casesForIdx(i)} onEdit={() => onCompose(i)} onDelete={() => onDelete(i)} tone="sage" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Apparatus (Editorial/Statutory notes, Executive Documents) collapses into a
// disclosure panel so the operative law reads on its own. Citations inside the
// notes still link.
function NotePanel({ body, seg, citations, markRe, spans }: {
  body: string;
  seg: BodySegment;
  citations: DocCitationRow[];
  markRe: RegExp | null;
  spans: { s: number; e: number }[];
}) {
  const [open, setOpen] = useState(false);
  const paras = useMemo(() => splitParagraphs(body, seg.start, seg.end, spans), [body, seg.start, seg.end, spans]);
  if (paras.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-card lg:mr-[21.5rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="citation-tag text-muted-foreground">{seg.heading}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{paras.length}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-4 pb-4 pt-3 text-[0.95em] text-foreground/70">
          {paras.map((p, i) => (
            <div key={i} className={LEVEL_INDENT[p.level]}>
              {p.label && <span className="mr-1.5 font-mono text-[11px] text-foreground/40">{p.label}</span>}
              {renderDecorated(body, p.start, p.end, citations, markRe)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// An IRM subsection, folded into its own accordion: the dotted number + title
// read as the header (always visible, so the section scans top-to-bottom like a
// table of contents), and everything up to the next heading collapses beneath.
// Indented by its depth in the dotted hierarchy so nested subsections step in.
// The operative paragraphs inside keep their original `para-N` ids, so the
// marginalia rail and citation anchors still line up.
function IrmSection({ num, title, indent, count, open, onToggle, headId, children }: {
  num: string;
  title: string;
  indent: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  headId: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/50"
      style={indent ? { marginLeft: `${Math.min(indent, 4) * 1.1}rem` } : undefined}
    >
      <button
        type="button"
        id={headId}
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left scroll-mt-24"
      >
        <span className="min-w-0">
          <span className="citation-tag text-muted-foreground">{num}</span>
          {title && (
            <span className="mt-0.5 block font-display text-[0.95rem] font-semibold leading-snug">{title}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {count > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{count}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="space-y-2.5 border-t border-border/40 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function LegalBody({ body, segments, opParas, citations, q, identifier, docMeta }: {
  body: string;
  segments: BodySegment[];
  opParas: LegalPara[];
  citations: DocCitationRow[];
  q?: string;
  identifier: string;
  docMeta: { sourceCode: string; sectionLabel: string; heading: string };
}) {
  const markRe = useMemo(() => buildMarkRe(q), [q]);
  const spans = useMemo(() => citationSpans(citations), [citations]);
  const notePanels = useMemo(() => segments.filter((s) => s.kind === "note"), [segments]);
  const mg = useMarginalia({ identifier, ...docMeta });
  const cb = useCases();
  const caseList = cb.list();
  const [composing, setComposing] = useState<number | null>(null);

  const refOf = useCallback((i: number) => ({ identifier, paraIndex: i }), [identifier]);
  const casesForIdx = useCallback((i: number) => cb.casesForRef(refOf(i)), [cb, refOf]);

  // IRM-style sections break each subsection (number + title) into its own
  // labelled block so the wall of text reads as a structured document; empty for
  // every other source / shape, so the flat render below is the default and
  // nothing else changes. Blocks are OPEN by default — the section reads
  // top-to-bottom — and each header can be collapsed to fold that part away.
  const blocks = useMemo(() => subsectionBlocks(docMeta.sourceCode, body, opParas), [docMeta.sourceCode, body, opParas]);
  const minDepth = useMemo(() => (blocks.length ? Math.min(...blocks.map((b) => b.depth)) : 0), [blocks]);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const toggleBlock = useCallback((bi: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(bi)) next.delete(bi); else next.add(bi);
      return next;
    });
  }, []);

  // Measure each paragraph's vertical offset within the body wrapper so the rail
  // can float notes at their anchor's height. Re-measures on reflow (window
  // resize, font-size change, web-font load) via a ResizeObserver on the wrapper.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<number[]>([]);
  const [wrapH, setWrapH] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const top = wrap.getBoundingClientRect().top;
      setAnchors(
        opParas.map((_, i) => {
          const el = wrap.querySelector<HTMLElement>(`#para-${i}`);
          return el ? el.getBoundingClientRect().top - top : 0;
        }),
      );
      setWrapH(wrap.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    window.addEventListener("resize", measure);
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) fonts.ready.then(measure).catch(() => {});
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [opParas.length, body]);

  const saveAt = (idx: number, text: string, caseIds: string[]) => {
    if (text.trim()) cb.syncNote(refOf(idx), caseIds);
    else cb.syncNote(refOf(idx), []); // emptied note → drop from every case
    mg.setNote(idx, text);
    setComposing(null);
  };
  const deleteAt = (idx: number) => { cb.syncNote(refOf(idx), []); mg.removeNote(idx); };

  return (
    <div className="space-y-2.5">
      {/* Marginalia header — client-only, so no hydration mismatch. A single row
          over the reading column; the Desk now lives in the screen's right margin
          (pinned to the wall by MarginaliaRail), so it needs no column header. */}
      {mg.hydrated && (
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/40 pb-2">
          <span className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground">
            <PenLine className="h-3 w-3 text-ochre" />
            {mg.count === 0 ? "marginalia · jot a note · type @ to file it under a case" : "your marginalia"}
          </span>
          {cb.hydrated && caseList.length > 0 ? (
            <Link to="/cases" className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-terracotta/80 hover:text-terracotta">
              <Scale className="h-3 w-3" /> {caseList.length} case{caseList.length === 1 ? "" : "s"}
            </Link>
          ) : (
            <span className="shrink-0 font-mono text-[10px] text-foreground/40">
              {mg.count === 0 ? "saved on this device" : `${mg.count} ${mg.count === 1 ? "note" : "notes"}`}
            </span>
          )}
        </div>
      )}

      {/* Reading column fills the width; the Desk rail is absolutely pinned to the
          right margin (relative anchor = this wrapper, so notes still line up with
          their paragraphs and scroll with the text). */}
      <div ref={wrapRef} className="relative">
        <div className="min-w-0 space-y-2.5">
          {(() => {
            const renderPara = (p: LegalPara, i: number) => (
              <Para
                key={`op-${i}`}
                id={`para-${i}`}
                body={body}
                p={p}
                citations={citations}
                markRe={markRe}
                hasNote={mg.hydrated && (mg.notes[i]?.text?.length ?? 0) > 0}
                selected={composing === i}
                hydrated={mg.hydrated}
                zebra={i % 2 === 1}
                onCompose={() => setComposing(i)}
              />
            );
            // No inline headings (every non-IRM source, and IRM sections without
            // them): the plain flat paragraph list, exactly as before.
            if (blocks.length === 0) return opParas.map((p, i) => renderPara(p, i));
            // Otherwise: any preamble above the first heading reads flat, then
            // each subsection folds into its accordion.
            return (
              <>
                {opParas.slice(0, blocks[0].headIdx).map((p, i) => renderPara(p, i))}
                {blocks.map((b, bi) => {
                  const inner: ReactNode[] = [];
                  for (let i = b.bodyStart; i < b.bodyEnd; i++) inner.push(renderPara(opParas[i], i));
                  return (
                    <IrmSection
                      key={`sub-${bi}`}
                      num={b.num}
                      title={b.title}
                      indent={b.depth - minDepth}
                      count={inner.length}
                      open={!collapsed.has(bi)}
                      onToggle={() => toggleBlock(bi)}
                      headId={`para-${b.headIdx}`}
                    >
                      {inner}
                    </IrmSection>
                  );
                })}
              </>
            );
          })()}
        </div>

        {mg.hydrated && (
          <MarginaliaRail
            anchors={anchors}
            height={wrapH}
            notes={mg.notes}
            cases={caseList}
            casesForIdx={casesForIdx}
            composing={composing}
            onCompose={(idx) => setComposing(idx)}
            onSave={saveAt}
            onCreateCase={cb.create}
            onCancel={() => setComposing(null)}
            onDelete={deleteAt}
          />
        )}
      </div>

      {/* The Desk on narrow widths — notes stacked below the article, never
          inline in the prose, so the reading column above never reflows. */}
      {mg.hydrated && (
        <DeskStacked
          notes={mg.notes}
          composing={composing}
          cases={caseList}
          casesForIdx={casesForIdx}
          onCompose={setComposing}
          onSave={saveAt}
          onCreateCase={cb.create}
          onCancel={() => setComposing(null)}
          onDelete={deleteAt}
        />
      )}

      {notePanels.map((seg, i) => (
        <NotePanel key={`note-${i}`} body={body} seg={seg} citations={citations} markRe={markRe} spans={spans} />
      ))}
    </div>
  );
}

// Court cases that cite this section — fetched client-side from CourtListener
// (cached in cloud Supabase, 7-day TTL). Visible to everyone: it's the free
// conversion hook showing the law in action before the user subscribes.
function CasesPanel({ identifier }: { identifier: string }) {
  const [cases, setCases] = useState<ClCase[] | null>(null);

  useEffect(() => {
    fetchSectionCases({ data: { identifier } })
      .then((r) => setCases(r.cases))
      .catch(() => setCases([]));
  }, [identifier]);

  if (!cases || cases.length === 0) return null;

  return (
    <details className="group mt-12 rounded-2xl border border-border/60 bg-card">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Landmark className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">Cases citing this section</span>
          <span className="citation-tag text-muted-foreground">
            {cases.length} court record{cases.length === 1 ? "" : "s"} · sorted by precedential weight
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/40 px-5 pb-6 pt-5">
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.cl_cluster_id}>
              <Link
                to="/case/$clusterId"
                params={{ clusterId: String(c.cl_cluster_id) }}
                className="group/case flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/50 px-3.5 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold leading-snug text-foreground group-hover/case:text-accent">
                    {c.case_name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 citation-tag text-muted-foreground">
                    {c.court && <span>{courtDisplay(c.court)}</span>}
                    {c.date_filed && (
                      <>
                        {c.court && <span className="text-foreground/20">·</span>}
                        <span>{c.date_filed.slice(0, 4)}</span>
                      </>
                    )}
                    {c.cite_count > 0 && (
                      <>
                        <span className="text-foreground/20">·</span>
                        <span>{c.cite_count.toLocaleString()} citations</span>
                      </>
                    )}
                    {c.outcome && (
                      <>
                        <span className="text-foreground/20">·</span>
                        <span className="text-ochre/80">{c.outcome}</span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowUp className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-muted-foreground/40 group-hover/case:text-accent/60" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 citation-tag text-muted-foreground/70">
          Cases via{" "}
          <a href="https://www.courtlistener.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground">
            CourtListener
          </a>
          {" "}· read the full opinion on their site · Juri (Pro) can search and analyze these for your situation
        </p>
      </div>
    </details>
  );
}

export const Route = createFileRoute("/code/$")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  loader: async ({ params }) => {
    const identifier = "/" + params._splat;
    const [res, sourcesRes] = await Promise.all([
      getDocument({ data: { identifier } }),
      listSources(),
    ]);
    if (!res.document) throw notFound();
    return { ...res, sources: sourcesRes.sources };
  },
  component: DocumentPage,
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </article>
    </div>
  ),
  head: ({ loaderData, params }) => {
    const d = loaderData?.document;
    if (!d) return { meta: [{ title: `Not found · ${SITE_BRAND}` }] };
    // The <title> is the whole game on these pages: lead with the citation in
    // the form people actually search/type — "26 U.S.C. § 1", the title number
    // fused up front — then the plain section name, then the brand. The hierarchy
    // chain moves into the description and on-page, never the title where it'd
    // push the searchable part past Google's ~60-char cut. See docSeo().
    const isState = d.source_code in STATE_NAMES;
    const { title: fullTitle, ogTitle, description } = docSeo(d);
    const label = `${d.section_label ?? ""} ${d.heading ?? ""}`.trim();
    const parent = d.parent_label ? formatGroupCrumb(d.source_code, d.parent_label) : "";
    const body = (d.body_text ?? "").replace(/\s+/g, " ").trim();
    const url = `https://self-law.org/code/${params._splat}`;

    // Structured data: a Legislation node (the statute/section itself) plus a
    // BreadcrumbList mirroring the jurisdiction → parent → section hierarchy, so
    // Google can render the trail and understand the page as primary law.
    const sourceLabel = sourceName(d.source_code);
    const crumbs: { name: string; item: string }[] = [
      { name: SITE_BRAND, item: "https://self-law.org" },
      { name: sourceLabel, item: `https://self-law.org/code/source/${encodeURIComponent(d.source_code)}` },
    ];
    if (parent) crumbs.push({ name: parent, item: url });
    crumbs.push({ name: label || sourceLabel, item: url });
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Legislation",
          name: label || sourceLabel,
          legislationIdentifier: d.identifier,
          isPartOf: { "@type": "Legislation", name: sourceLabel },
          legislationJurisdiction: isState ? STATE_NAMES[d.source_code] : "United States",
          inLanguage: "en",
          url,
          ...(body ? { text: body.slice(0, 500) + (body.length > 500 ? "…" : "") } : {}),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: c.item,
          })),
        },
      ],
    };

    return {
      meta: [
        { title: fullTitle },
        { name: "description", content: description },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(ld) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Document not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That citation isn't in our index yet.
      </p>
      <Link to="/code" className="mt-6 inline-block underline">Back to the Code</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load that document</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {import.meta.env.DEV ? error.message : "An unexpected error occurred."}
      </p>
    </div>
  ),
});

const SOURCE_NAMES: Record<string, string> = {
  const: "Constitution",
  usc: "U.S. Code",
  cfr: "CFR",
  ucc: "UCC",
  tfm: "TFM",
  irm: "IRM",
  ...STATE_NAMES, // state sources (pa → "Pennsylvania", …) for the source badge + trace panels
};

function DocOutline({ body, opParas }: { body: string; opParas: LegalPara[] }) {
  const items = useMemo(
    () =>
      opParas
        .map((p, i) => ({ ...p, idx: i, preview: body.slice(p.start, p.end).trim() }))
        .filter((p) => p.level === 1 && p.label),
    [body, opParas],
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (items.length < 3) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const num = parseInt(id.replace("para-", ""), 10);
          setActiveIdx(num);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    for (const item of items) {
      const el = document.getElementById(`para-${item.idx}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Network className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">In this section</span>
          <span className="citation-tag text-muted-foreground">{items.length} parts</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <nav className="max-h-[60vh] space-y-0.5 overflow-y-auto border-t border-border/40 px-3 pb-3 pr-1 pt-2">
          {items.map((p) => {
            const isActive = p.idx === activeIdx;
            return (
              <a
                key={p.idx}
                href={`#para-${p.idx}`}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-1.5 rounded-md px-2 py-1 text-[11px] leading-snug transition-colors ${
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className="ci-pill">{p.label}</span>
                <span className="line-clamp-2">{p.preview.length > 55 ? p.preview.slice(0, 55) + "…" : p.preview}</span>
              </a>
            );
          })}
        </nav>
      )}
    </section>
  );
}

// Cross-references collapse into a single disclosure below the statute. The
// reader sees the law first; "what else points here" waits until they ask for
// it. Replaces the old always-on right rail. Default closed.
//
// Uses a native <details> (not React state) on purpose: the children render
// into the DOM even while collapsed, so the citation links — traces-out AND
// cited-by, one per related section — are in the SSR HTML and Googlebot follows
// them. Across millions of edges that's the internal link graph that makes the
// corpus crawlable (the moat). A client-only toggle would hide all of it.
function ConnectionsDisclosure({
  citedByTotal,
  tracesCount,
  externalCount,
  children,
}: {
  citedByTotal: number;
  tracesCount: number;
  externalCount: number;
  children: ReactNode;
}) {
  if (citedByTotal === 0 && tracesCount === 0 && externalCount === 0) return null;
  const bits: string[] = [];
  if (citedByTotal > 0) bits.push(`${citedByTotal.toLocaleString()} cite this`);
  if (tracesCount > 0) bits.push(`traces to ${tracesCount}`);
  if (externalCount > 0 && citedByTotal === 0 && tracesCount === 0) bits.push(`${externalCount} off-index`);
  return (
    <details className="group mt-12 rounded-2xl border border-border/60 bg-card">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Network className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">Connections</span>
          <span className="citation-tag text-muted-foreground">{bits.join(" · ")}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-8 border-t border-border/40 px-5 pb-7 pt-6">{children}</div>
    </details>
  );
}

function DocumentPage() {
  const { document, citations, incoming, incoming_total, inbound_by_source, prev, next, sources } = Route.useLoaderData();
  const search = useSearch({ from: "/code/$" }) as { q?: string };
  const [fontSize, setFontSize] = useState<number>(2); // 0..4
  const [showTop, setShowTop] = useState(false);
  const [copied, setCopied] = useState(false);
  // Reading ruler — a horizontal highlight band that tracks the cursor so the
  // eye doesn't lose its line in long statutory text. Toggle persists.
  const [ruler, setRuler] = useState(false);
  const [rulerY, setRulerY] = useState(-9999);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("doc-font-size") : null;
    if (stored !== null) {
      const n = Number(stored);
      if (!Number.isNaN(n) && n >= 0 && n <= 4) setFontSize(n);
    }
    if (typeof window !== "undefined" && window.localStorage.getItem("doc-ruler") === "1") setRuler(true);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("doc-font-size", String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("doc-ruler", ruler ? "1" : "0");
  }, [ruler]);
  // Track the cursor's Y while the ruler is on (window-level so it follows even
  // over margin notes); pointer-events stay off the band itself. On enable, seat
  // the band mid-viewport so it's visible immediately (before the first move).
  useEffect(() => {
    if (!ruler) { setRulerY(-9999); return; }
    setRulerY((y) => (y < 0 ? window.innerHeight / 2 : y));
    const onMove = (e: globalThis.MouseEvent) => setRulerY(e.clientY);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [ruler]);
  // Keyboard control — ↑/↓ nudge the ruler line by a step (and stop the page
  // from scrolling). Mouse still wins when moved; arrows fine-tune hands-free.
  useEffect(() => {
    if (!ruler) return;
    const STEP = 26;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      const max = window.innerHeight - 4;
      setRulerY((y) => {
        const cur = y < 0 ? window.innerHeight / 2 : y;
        return Math.max(4, Math.min(max, cur + (e.key === "ArrowDown" ? STEP : -STEP)));
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ruler]);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const body = document?.body_text ?? "";
  const spans = useMemo(() => citationSpans(citations), [citations]);
  const segments = useMemo(() => segmentBody(document?.source_code ?? "", body), [document?.source_code, body]);
  const opParas = useMemo(() => operativeParagraphs(body, segments, spans), [body, segments, spans]);

  if (!document) return null;

  // Outgoing citations: dedupe by target (a section often cites the same doc
  // many times). Resolved → grouped link rail; unresolved → "not in our index".
  const seenInternal = new Set<string>();
  const internal: DocCitationRow[] = [];
  for (const c of citations) {
    if (!c.to_identifier || seenInternal.has(c.to_identifier)) continue;
    seenInternal.add(c.to_identifier);
    internal.push(c);
  }
  const seenExternal = new Set<string>();
  const external: DocCitationRow[] = [];
  for (const c of citations) {
    if (c.to_identifier) continue;
    const key = c.target_cite || `${c.target_type}:${c.span_start}`;
    if (seenExternal.has(key)) continue;
    seenExternal.add(key);
    external.push(c);
  }

  const traceBySource = new Map<string, DocCitationRow[]>();
  for (const c of internal) {
    const k = c.target_source ?? "?";
    const arr = traceBySource.get(k) ?? [];
    arr.push(c);
    traceBySource.set(k, arr);
  }

  // Citation-graph nodes: resolved internal targets (clickable) plus a few
  // case-law / off-corpus cites (labeled, not linked — look them up). Reserve
  // slots so case cites surface even when a section has many internal targets.
  const CASE_ORDER = (k: string) =>
    ["scotus", "sct", "fed_app", "fed_supp", "led"].includes(k) ? 0 : 1;
  const extForGraph = [...external].sort((a, b) => CASE_ORDER(a.target_type) - CASE_ORDER(b.target_type));
  const shortId = (id: string) => id.split("/").filter(Boolean).slice(-1)[0] ?? id;
  const graphTraces: GraphTrace[] = [
    ...internal.slice(0, 9).map((c): GraphTrace => ({
      key: `i${c.to_identifier}`,
      title: c.target_heading || c.to_identifier || c.target_cite,
      sub: c.target_section_label || shortId(c.to_identifier ?? ""),
      source: c.target_source ?? "",
      href: c.to_identifier,
      kind: c.target_type,
    })),
    ...extForGraph.slice(0, 5).map((c): GraphTrace => ({
      key: `x${c.target_cite}`,
      title: c.target_cite,
      sub: c.target_cite,
      source: "",
      href: null,
      kind: c.target_type,
    })),
  ];
  const graphCitedBy = inbound_by_source.filter((r: InboundBySource) => r.source);
  const centerLabel = document.section_label || document.heading || shortId(document.identifier);
  const centerSub = document.section_label ? document.heading ?? "" : "";

  const fontClass = ["text-[1.05rem]", "text-[1.15rem]", "text-[1.25rem]", "text-[1.4rem]", "text-[1.55rem]"][fontSize];
  const readingMin = document.word_count ? Math.max(1, Math.round(document.word_count / 220)) : null;


  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  // Citation/connection panels — rendered in the right rail at xl+, and
  // inline below the article on smaller screens so nothing is hidden.
  // `incoming` is the authority-ranked top slice; `incoming_total` is the true
  // count. Group the slice by source for display.
  const incomingBySource = new Map<string, IncomingCitation[]>();
  for (const c of incoming) {
    const arr = incomingBySource.get(c.source) ?? [];
    arr.push(c);
    incomingBySource.set(c.source, arr);
  }

  const tracesPanel = internal.length > 0 ? (
    <div>
      <div className="citation-tag text-accent">
        Traces to {internal.length} document{internal.length === 1 ? "" : "s"}
      </div>
      <div className="mt-3 space-y-5">
        {Array.from(traceBySource.entries()).map(([src, items]) => (
          <div key={src}>
            <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {SOURCE_NAMES[src] ?? src}
            </div>
            <ul className="space-y-2">
              {items.map((c, i) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: (c.to_identifier ?? "").replace(/^\//, "") }}
                    className="block rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <div className="font-display font-semibold leading-snug">
                      {c.target_heading || c.to_identifier}
                    </div>
                    <div className="citation-tag mt-0.5 text-muted-foreground">
                      {c.target_section_label ?? c.to_identifier}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const citedByPanel = incoming.length > 0 ? (
    <div>
      <div className="citation-tag text-accent">
        Cited by {incoming_total.toLocaleString()} section{incoming_total === 1 ? "" : "s"}
        {incoming_total > incoming.length ? (
          <span className="text-muted-foreground"> · top {incoming.length}</span>
        ) : null}
      </div>
      <div className="mt-3 space-y-5">
        {Array.from(incomingBySource.entries()).map(([src, items]) => (
          <div key={src}>
            <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {SOURCE_NAMES[src] ?? src}
            </div>
            <ul className="space-y-2">
              {items.map((c: IncomingCitation, i: number) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.identifier.replace(/^\//, "") }}
                    className="block rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <div className="citation-tag text-muted-foreground">
                      {c.section_label ?? c.identifier}
                    </div>
                    <div className="font-display font-semibold leading-snug">{c.heading}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const graphPanel =
    graphTraces.length > 0 || graphCitedBy.length > 0 ? (
      <SectionCitationGraph
        centerLabel={centerLabel}
        centerSub={centerSub}
        centerSource={document.source_code}
        traces={graphTraces}
        citedBy={graphCitedBy}
        citedByTotal={incoming_total}
        tracesTotal={internal.length + external.length}
      />
    ) : null;

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-[1360px]">
      {/* Sticky breadcrumb / utility bar — docks below the SiteHeader */}
      <div className="sticky top-[68px] z-30 -mx-6 -mt-10 mb-6 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex items-center gap-3 px-6 py-2.5">
          <div className="citation-tag min-w-0 flex-1 truncate text-muted-foreground">
            {search.q ? (
              <Link
                to="/search"
                search={{ q: search.q }}
                className="inline-flex items-center gap-1 text-accent hover:text-accent/80"
              >
                <ArrowLeft className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[12rem]">Results for "{search.q}"</span>
              </Link>
            ) : (
              <>
                <Link to="/code" className="hover:text-foreground">Code</Link>
                {" · "}
                <Link to="/code/source/$source" params={{ source: document.source_code }} className="hover:text-foreground">
                  {SOURCE_NAMES[document.source_code] ?? document.source_code.toUpperCase()}
                </Link>
                {document.parent_label ? <> · <span className="text-foreground/70">{formatGroupCrumb(document.source_code, document.parent_label)}</span></> : null}
                {document.section_label ? <> · <span className="text-foreground/70">{document.section_label}</span></> : null}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-0.5 rounded-full border border-border/70 bg-card px-1 py-0.5 sm:flex">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(0, s - 1))}
                disabled={fontSize === 0}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                aria-label="Decrease text size"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 text-[10px] font-medium text-muted-foreground">Aa</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(4, s + 1))}
                disabled={fontSize === 4}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                aria-label="Increase text size"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRuler((v) => !v)}
              aria-pressed={ruler}
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors sm:flex ${
                ruler
                  ? "border-ochre/60 bg-ochre/15 text-foreground"
                  : "border-border/70 bg-card text-foreground/80 hover:border-foreground/40 hover:text-foreground"
              }`}
              aria-label="Toggle reading ruler"
              title="Reading ruler — highlights your line; follows the cursor, or use ↑/↓ to move it"
            >
              <Highlighter className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Ruler</span>
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground/80 hover:border-foreground/40 hover:text-foreground"
              aria-label="Copy link to this section"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <LinkIcon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* The whole reading block reserves a right lane (lg:pr) for the Desk, which
          MarginaliaRail pins to the screen's right margin. Title, body, connections
          and prev/next all share that one reading width — "everything same width" —
          while the notes sit against the wall instead of fighting for the center. */}
      {/* Left gutter (lg:pl-16) pulls the reading column toward center so the
          fixed Juri launcher in the bottom-left corner never overlays the text;
          the faint rule sits in that gutter like a ruled legal-pad margin. */}
      <article className="relative lg:pr-[22rem] lg:pl-16 lg:before:absolute lg:before:bottom-0 lg:before:left-7 lg:before:top-1 lg:before:w-px lg:before:bg-border/50 lg:before:content-['']">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {document.section_label ? <span className="text-foreground/60">{document.section_label}. </span> : null}
            <span className="ink-underline italic">{document.heading}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {document.word_count ? <span>{document.word_count.toLocaleString()} words</span> : null}
            {readingMin ? <><span className="text-foreground/30">·</span><span>~{readingMin} min read</span></> : null}
            <span className="text-foreground/30">·</span>
            <code className="font-mono text-[11px]">{document.identifier}</code>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
            <Scale className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
            A research copy — for the controlling text, always check the official
            state or federal source. Not legal advice.
          </p>
        </div>

        <div className="mt-8">
          <div>
            <div className="mb-6"><DocOutline body={body} opParas={opParas} /></div>
            <DefinitionsPanel text={body} />
          </div>
          <div className={`statute-prose font-serif text-foreground ${fontClass}`}>
            <LegalBody
              body={body}
              segments={segments}
              opParas={opParas}
              citations={citations}
              q={search.q}
              identifier={document.identifier}
              docMeta={{ sourceCode: document.source_code, sectionLabel: document.section_label ?? "", heading: document.heading ?? "" }}
            />
          </div>
        </div>

        {/* Court cases that have applied or cited this section — free, visible
            before login. Fetched from CourtListener, cached 7 days. */}
        <CasesPanel identifier={document.identifier} />

        {/* Everything that references or feeds this section, folded into one
            disclosure so the operative law reads uninterrupted. Default closed. */}
        <ConnectionsDisclosure
          citedByTotal={incoming_total}
          tracesCount={internal.length}
          externalCount={external.length}
        >
          <div className="grid gap-8 lg:grid-cols-2">
            {citedByPanel}
            {tracesPanel}
          </div>
          {external.length > 0 && (
            <div>
              <div className="citation-tag text-muted-foreground">
                {external.length} reference{external.length === 1 ? "" : "s"} not yet in our index
              </div>
              <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                {external.slice(0, 40).map((c: DocCitationRow, i: number) => (
                  <li key={i} className="truncate font-mono text-xs">{c.target_cite}</li>
                ))}
              </ul>
              {external.length > 40 && (
                <div className="mt-2 text-xs text-muted-foreground">+ {external.length - 40} more</div>
              )}
            </div>
          )}
          {graphPanel}
        </ConnectionsDisclosure>

        {(prev || next) && (
          <nav className="mt-12 grid grid-cols-1 gap-3 border-t border-border/60 pt-6 sm:grid-cols-2 lg:mr-[21.5rem]">
            {prev ? (
              <Link
                to="/code/$"
                params={{ _splat: prev.identifier.replace(/^\//, "") }}
                className="group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <div className="min-w-0">
                  <div className="citation-tag text-muted-foreground">Previous</div>
                  <div className="mt-0.5 truncate font-display text-sm font-semibold">
                    {prev.section_label ? `${prev.section_label}. ` : ""}{prev.heading}
                  </div>
                </div>
              </Link>
            ) : <span />}
            {next ? (
              <Link
                to="/code/$"
                params={{ _splat: next.identifier.replace(/^\//, "") }}
                className="group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-right transition-colors hover:bg-muted/60 sm:flex-row-reverse"
              >
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="citation-tag text-muted-foreground">Next</div>
                  <div className="mt-0.5 truncate font-display text-sm font-semibold">
                    {next.section_label ? `${next.section_label}. ` : ""}{next.heading}
                  </div>
                </div>
              </Link>
            ) : <span />}
          </nav>
        )}

        {/* Cross-references now live in the <ConnectionsDisclosure> above,
            directly beneath the statute text — no separate rail or duplicate
            mobile block. */}
      </article>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-card text-foreground/80 shadow-[var(--shadow-warm)] transition-all hover:-translate-y-0.5 hover:text-foreground"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      {/* Reading ruler — a focus band locked to the cursor's (or ↑/↓'s) line.
          Fixed + pointer-events-none so it never blocks clicks/selection. A
          feathered warm band with a crisp center guide-line reads cleanly in
          both light and dark and tracks the eye without hiding the text. */}
      {ruler && rulerY > 0 && (
        <div
          aria-hidden
          className="reading-ruler pointer-events-none fixed inset-x-0 z-30 -translate-y-1/2"
          style={{ top: rulerY }}
        >
          <div className="reading-ruler-band" />
          <div className="reading-ruler-line" />
        </div>
      )}
    </ResearchShell>
  );
}
