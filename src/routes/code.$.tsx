import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, listSources, type DocCitationRow, type IncomingCitation } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Network, PenLine, Plus, Scale, X } from "lucide-react";
import { renderDecorated } from "@/lib/auto-link-citations";
import { segmentBody, splitParagraphs, citationSpans, operativeParagraphs, type BodySegment, type LegalPara } from "@/lib/legal-structure";
import { formatGroupCrumb } from "@/lib/label-format";
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

function MarginNote({ text, noteCases, onEdit, onDelete }: { text: string; noteCases: CaseRecord[]; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group/note relative rounded-lg border-l-[3px] border-ochre bg-ochre/[0.07] px-3 py-2.5 shadow-[var(--shadow-card)]">
      {noteCases.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {noteCases.map((c) => (
            <Link
              key={c.id}
              to="/cases/$id"
              params={{ id: c.id }}
              className="inline-flex items-center gap-1 rounded-full border border-ochre/55 bg-ochre/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-foreground/75 hover:bg-ochre/30"
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
        <div className="ml-auto flex gap-3 opacity-0 transition group-hover/note:opacity-100">
          <button type="button" onClick={onEdit} className="font-mono text-[10px] uppercase tracking-wider text-foreground/40 hover:text-foreground">edit</button>
          <button type="button" onClick={onDelete} className="font-mono text-[10px] uppercase tracking-wider text-destructive/70 hover:text-destructive">delete</button>
        </div>
      </div>
    </div>
  );
}

// One operative paragraph, read at full column width. Its marginalia is drawn
// by MarginaliaRail beside the text at lg+; on narrow screens the note (or a
// single small pencil to add one) lives inline right here.
function Para({ id, body, p, citations, markRe, noteText, noteCases, cases, hydrated, composing, onStartCompose, onSave, onCreateCase, onCancel, onDelete }: {
  id: string;
  body: string;
  p: LegalPara;
  citations: DocCitationRow[];
  markRe: RegExp | null;
  noteText: string | undefined;
  noteCases: CaseRecord[];
  cases: CaseRecord[];
  hydrated: boolean;
  composing: boolean;
  onStartCompose: () => void;
  onSave: (text: string, caseIds: string[]) => void;
  onCreateCase: (name: string) => string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const hasNote = hydrated && typeof noteText === "string" && noteText.length > 0;
  return (
    <div id={id} className="group/para scroll-mt-24">
      <div className={`flex gap-3 ${LEVEL_INDENT[p.level]}`}>
        {p.label && <span className="ci-pill">{p.label}</span>}
        <span
          className={
            hasNote
              ? `${p.label ? "flex-1" : "block"} -ml-3 border-l-2 border-ochre/70 bg-gradient-to-r from-ochre/10 to-transparent pl-3`
              : p.label
                ? "flex-1"
                : ""
          }
        >
          {renderDecorated(body, p.start, p.end, citations, markRe)}
        </span>
        {/* mobile add affordance — a single quiet pencil, never a box per line */}
        {hydrated && !composing && (
          <button
            type="button"
            onClick={onStartCompose}
            aria-label={hasNote ? "Edit margin note" : "Add a margin note"}
            className="shrink-0 self-start rounded-md p-1 text-ochre/50 opacity-50 transition hover:bg-ochre/10 hover:text-ochre group-hover/para:opacity-80 lg:hidden"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* mobile-only inline note / composer (the rail handles lg+) */}
      {hydrated && (composing || hasNote) && (
        <div className="mt-2 pl-3 lg:hidden">
          {composing ? (
            <MarginComposer
              initial={noteText ?? ""}
              initialCases={noteCases.map((c) => c.id)}
              cases={cases}
              onSave={onSave}
              onCreateCase={onCreateCase}
              onCancel={onCancel}
            />
          ) : (
            <MarginNote text={noteText as string} noteCases={noteCases} onEdit={onStartCompose} onDelete={onDelete} />
          )}
        </div>
      )}
    </div>
  );
}

// Rough rendered height of a note card, used for first-paint stacking before we
// measure the real DOM heights. The Desk rail is now wide (fills text→wall), so
// ~44 chars/line; real heights are measured after paint anyway.
function estimateNoteH(text: string) {
  const lines = Math.max(2, Math.ceil(text.length / 44));
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

  return (
    <div
      className="relative hidden lg:block"
      style={{ minHeight: height }}
      onMouseMove={(e) => setHoverY(railY(e))}
      onMouseLeave={() => setHoverY(null)}
      onClick={(e) => { if (e.target === e.currentTarget) onCompose(nearest(railY(e))); }}
    >
      {/* the ruled margin line + faint ruling ticks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-border/50" />
      {marks.map((y) => (
        <div key={`m-${y}`} className="pointer-events-none absolute left-0 h-px w-3 bg-border/70" style={{ top: y }} />
      ))}

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
    <div className="mt-4 rounded-2xl border border-border/60 bg-card">
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
      {/* Marginalia intro / count — client-only, so no hydration mismatch. */}
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
              {mg.count === 0 ? "saved on this device" : `${mg.count} ${mg.count === 1 ? "note" : "notes"} · this device`}
            </span>
          )}
        </div>
      )}

      <div ref={wrapRef} className="lg:grid lg:grid-cols-[minmax(0,46rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-2.5">
          {opParas.map((p, i) => (
            <Para
              key={`op-${i}`}
              id={`para-${i}`}
              body={body}
              p={p}
              citations={citations}
              markRe={markRe}
              noteText={mg.notes[i]?.text}
              noteCases={mg.hydrated ? casesForIdx(i) : []}
              cases={caseList}
              hydrated={mg.hydrated}
              composing={composing === i}
              onStartCompose={() => setComposing(i)}
              onSave={(text, ids) => saveAt(i, text, ids)}
              onCreateCase={cb.create}
              onCancel={() => setComposing(null)}
              onDelete={() => deleteAt(i)}
            />
          ))}
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

      {notePanels.map((seg, i) => (
        <NotePanel key={`note-${i}`} body={body} seg={seg} citations={citations} markRe={markRe} spans={spans} />
      ))}
    </div>
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
    if (!d) return { meta: [{ title: "Not found · Marginalia" }] };
    const label = `${d.section_label ?? ""} ${d.heading ?? ""}`.trim();
    const parent = d.parent_label ? formatGroupCrumb(d.source_code, d.parent_label) : "";
    const fullTitle = `${label}${parent ? ` — ${parent}` : ""} · Marginalia`;
    const ogTitle = `${label}${parent ? ` — ${parent}` : ""}`;
    const body = (d.body_text ?? "").replace(/\s+/g, " ").trim();
    const description = body
      ? body.slice(0, 155) + (body.length > 155 ? "…" : "")
      : `${label} on Marginalia — read the source text with cross-references to related statutes and regulations.`;
    const url = `https://self-law.org/code/${params._splat}`;
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
    <div>
      <div className="citation-tag mb-2 px-1 text-muted-foreground">in this section</div>
      <nav className="max-h-[60vh] space-y-0.5 overflow-y-auto pr-1">
        {items.map((p) => {
          const isActive = p.idx === activeIdx;
          return (
            <a
              key={p.idx}
              href={`#para-${p.idx}`}
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
    </div>
  );
}

// Cross-references collapse into a single disclosure below the statute. The
// reader sees the law first; "what else points here" waits until they ask for
// it. Replaces the old always-on right rail. Default closed.
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
  const [open, setOpen] = useState(false);
  if (citedByTotal === 0 && tracesCount === 0 && externalCount === 0) return null;
  const bits: string[] = [];
  if (citedByTotal > 0) bits.push(`${citedByTotal.toLocaleString()} cite this`);
  if (tracesCount > 0) bits.push(`traces to ${tracesCount}`);
  if (externalCount > 0 && citedByTotal === 0 && tracesCount === 0) bits.push(`${externalCount} off-index`);
  return (
    <section className="mt-12 rounded-2xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Network className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">Connections</span>
          <span className="citation-tag text-muted-foreground">{bits.join(" · ")}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-8 border-t border-border/40 px-5 pb-7 pt-6">{children}</div>}
    </section>
  );
}

function DocumentPage() {
  const { document, citations, incoming, incoming_total, prev, next, sources } = Route.useLoaderData();
  const search = useSearch({ from: "/code/$" }) as { q?: string };
  const [fontSize, setFontSize] = useState<number>(2); // 0..4
  const [showTop, setShowTop] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("doc-font-size") : null;
    if (stored !== null) {
      const n = Number(stored);
      if (!Number.isNaN(n) && n >= 0 && n <= 4) setFontSize(n);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("doc-font-size", String(fontSize));
  }, [fontSize]);
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

  const graphPlaceholder = (
    <div className="rounded-lg border border-dashed border-border/70 bg-card p-3 text-xs text-foreground/65">
      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
        <Network className="h-3.5 w-3.5" />
        Citation graph
      </div>
      <p className="mt-1 leading-relaxed">
        A visual map of what this section depends on and what depends on it — rendering here once the graph component ships.
      </p>
    </div>
  );

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-[1700px]">
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

      {/* Reading block nudged right of the left edge; title + apparatus held to
          the same reading measure as the body's text column, while the body grid
          lets the marginalia "Desk" fill everything from the text to the wall. */}
      <article className="lg:pl-[5vw]">
        <div className="lg:max-w-[46rem]">
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
        </div>

        <div className="mt-8">
          <div className="lg:max-w-[46rem]">
            <div className="mb-6"><DocOutline body={body} opParas={opParas} /></div>
            <DefinitionsPanel text={body} />
          </div>
          <div className={`font-serif leading-relaxed text-foreground ${fontClass}`}>
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
          {graphPlaceholder}
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
        </ConnectionsDisclosure>

        {(prev || next) && (
          <nav className="mt-12 grid grid-cols-1 gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
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
    </ResearchShell>
  );
}
