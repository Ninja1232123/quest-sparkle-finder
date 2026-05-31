import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, listSources, type DocCitationRow, type IncomingCitation } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Network, PenLine, Plus } from "lucide-react";
import { renderDecorated } from "@/lib/auto-link-citations";
import { segmentBody, splitParagraphs, type BodySegment, type LegalPara } from "@/lib/legal-structure";
import { formatGroupCrumb } from "@/lib/label-format";

// Body rendering lives in @/lib/legal-structure (segmentBody / splitParagraphs)
// and @/lib/auto-link-citations (renderDecorated). Both work in original
// body_text offsets so citation_edges spans stay valid. See CITATION_GAMEPLAN.md.

const LEVEL_INDENT = ["", "pl-5", "pl-10", "pl-16"] as const;

// Citation byte spans, used both to place inline chips and to keep the
// soft-paragraph splitter from cutting through a cite.
function citationSpans(citations: DocCitationRow[]): { s: number; e: number }[] {
  const out: { s: number; e: number }[] = [];
  for (const c of citations) {
    if (c.span_start != null && c.span_end != null) out.push({ s: c.span_start, e: c.span_end });
  }
  return out;
}

// The operative paragraphs, flattened across every operative segment, in order.
// The flat index is the anchor id used by both the body and the outline, so
// they must derive it from the same inputs (segments + spans).
function operativeParagraphs(body: string, segments: BodySegment[], spans: { s: number; e: number }[]): LegalPara[] {
  const out: LegalPara[] = [];
  for (const seg of segments) {
    if (seg.kind === "operative") out.push(...splitParagraphs(body, seg.start, seg.end, spans));
  }
  return out;
}

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

// ── Reader marginalia ─────────────────────────────────────────────────────
// Handwritten notes pinned to a paragraph, persisted in localStorage keyed by
// section identifier + paragraph index. Device-local by design — nothing
// leaves the browser. Hydration-safe (loads after mount) so SSR renders the
// statute clean with no client/server mismatch; mirrors useShelf in compare.tsx.
const NOTES_KEY_VERSION = "v1";
function marginaliaKey(identifier: string) {
  return `marginalia.notes.${NOTES_KEY_VERSION}:${identifier}`;
}

function useMarginalia(identifier: string) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let loaded: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(marginaliaKey(identifier));
      if (raw) loaded = JSON.parse(raw) as Record<string, string>;
    } catch {
      /* ignore corrupt or blocked storage */
    }
    setNotes(loaded);
    setHydrated(true);
  }, [identifier]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const key = marginaliaKey(identifier);
      if (Object.keys(notes).length > 0) localStorage.setItem(key, JSON.stringify(notes));
      else localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [notes, hydrated, identifier]);

  const setNote = (idx: number, text: string) =>
    setNotes((prev) => {
      const next = { ...prev };
      const t = text.trim();
      if (t) next[idx] = t;
      else delete next[idx];
      return next;
    });
  const removeNote = (idx: number) =>
    setNotes((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });

  return { notes, hydrated, setNote, removeNote, count: Object.keys(notes).length };
}

function MarginComposer({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, []);
  return (
    <div className="rounded-xl border-[1.5px] border-ochre bg-card/80 px-3 py-2.5 shadow-[var(--shadow-card)]">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(draft); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        rows={3}
        placeholder="in your own words…"
        title="Enter to save · Esc to cancel"
        className="w-full resize-y border-0 bg-transparent font-hand text-[18px] leading-snug text-foreground outline-none placeholder:text-foreground/30"
      />
      <div className="mt-1 flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} className="rounded-full px-2 py-0.5 font-display text-[11px] font-semibold text-foreground/45 hover:text-foreground">
          Cancel
        </button>
        <button type="button" onClick={() => onSave(draft)} className="rounded-full bg-foreground px-2.5 py-0.5 font-display text-[11px] font-semibold text-background hover:opacity-90">
          Save
        </button>
      </div>
    </div>
  );
}

function MarginNote({ text, onEdit, onDelete }: { text: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group/note relative rounded-lg border-l-[3px] border-ochre bg-ochre/[0.07] px-3.5 py-3 shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onEdit}
        title="Click to edit"
        className="block cursor-text text-left font-hand text-[23px] leading-snug text-foreground hover:text-foreground"
      >
        {text}
      </button>
      <div className="mt-1.5 flex gap-3 opacity-0 transition group-hover/note:opacity-100">
        <button type="button" onClick={onEdit} className="font-mono text-[10px] uppercase tracking-wider text-foreground/40 hover:text-foreground">edit</button>
        <button type="button" onClick={onDelete} className="font-mono text-[10px] uppercase tracking-wider text-destructive/70 hover:text-destructive">delete</button>
      </div>
    </div>
  );
}

function ParaRow({ id, body, p, citations, markRe, note, hydrated, composing, onStartCompose, onSave, onCancel, onDelete }: {
  id: string;
  body: string;
  p: LegalPara;
  citations: DocCitationRow[];
  markRe: RegExp | null;
  note: string | undefined;
  hydrated: boolean;
  composing: boolean;
  onStartCompose: () => void;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const hasNote = hydrated && typeof note === "string" && note.length > 0;
  return (
    <div id={id} className="group/para lg:grid lg:grid-cols-[minmax(0,40rem)_1fr] lg:items-start lg:gap-10">
      {/* statute text */}
      <div className={`flex gap-3 ${LEVEL_INDENT[p.level]}`}>
        {p.label && (
          <span className="ci-pill">{p.label}</span>
        )}
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
      </div>

      {/* Margin — beside the text at lg+, stacked below on narrow screens.
          The note floats (absolute) inside its reserved 16rem column at lg+, so
          a growing note expands DOWN over the gutter without stretching this
          paragraph's grid row — the statute column never reflows. Client-only
          (hover-to-add, edit/delete) so there's no SSR/hydration mismatch. */}
      {hydrated && (
        <div className={`mt-2 ${LEVEL_INDENT[p.level]} lg:relative lg:mt-0 lg:pl-0`}>
          <div className="lg:absolute lg:left-0 lg:top-0 lg:w-full lg:max-w-[22rem]">
            {composing ? (
              <MarginComposer initial={note ?? ""} onSave={onSave} onCancel={onCancel} />
            ) : hasNote ? (
              <MarginNote text={note as string} onEdit={onStartCompose} onDelete={onDelete} />
            ) : (
              <button
                type="button"
                onClick={onStartCompose}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ochre/40 px-2.5 py-1.5 font-hand text-[17px] leading-tight text-foreground/45 opacity-60 transition hover:border-ochre/70 hover:bg-ochre/5 hover:text-foreground/80 hover:opacity-100 focus-visible:opacity-100 group-hover/para:opacity-100"
              >
                <PenLine className="h-3.5 w-3.5 shrink-0 text-ochre" /> note in the margin
              </button>
            )}
          </div>
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

function LegalBody({ body, segments, opParas, citations, q, identifier }: {
  body: string;
  segments: BodySegment[];
  opParas: LegalPara[];
  citations: DocCitationRow[];
  q?: string;
  identifier: string;
}) {
  const markRe = useMemo(() => buildMarkRe(q), [q]);
  const spans = useMemo(() => citationSpans(citations), [citations]);
  const notes = useMemo(() => segments.filter((s) => s.kind === "note"), [segments]);
  const mg = useMarginalia(identifier);
  const [composing, setComposing] = useState<number | null>(null);

  return (
    <div className="space-y-2.5">
      {/* Marginalia intro / count — client-only, so no hydration mismatch. */}
      {mg.hydrated && (
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/40 pb-2">
          <span className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground">
            <PenLine className="h-3 w-3 text-ochre" />
            {mg.count === 0 ? "marginalia · hover a line to jot a private note" : "your marginalia"}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-foreground/40">
            {mg.count === 0 ? "saved on this device" : `${mg.count} ${mg.count === 1 ? "note" : "notes"} · this device`}
          </span>
        </div>
      )}
      {opParas.map((p, i) => (
        <ParaRow
          key={`op-${i}`}
          id={`para-${i}`}
          body={body}
          p={p}
          citations={citations}
          markRe={markRe}
          note={mg.notes[i]}
          hydrated={mg.hydrated}
          composing={composing === i}
          onStartCompose={() => setComposing(i)}
          onSave={(text) => { mg.setNote(i, text); setComposing(null); }}
          onCancel={() => setComposing(null)}
          onDelete={() => mg.removeNote(i)}
        />
      ))}
      {notes.map((seg, i) => (
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
    <ResearchShell sources={sources} centerMaxWidth="max-w-7xl">
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

      <article>
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

        <div className="mt-8">
          <div className="mb-6"><DocOutline body={body} opParas={opParas} /></div>
          <DefinitionsPanel text={body} />
          <div className={`font-serif leading-relaxed text-foreground ${fontClass}`}>
            <LegalBody body={body} segments={segments} opParas={opParas} citations={citations} q={search.q} identifier={document.identifier} />
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
