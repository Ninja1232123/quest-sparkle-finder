import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, listSources, type DocCitationRow, type IncomingCitation } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Network, Plus } from "lucide-react";
import { AddToCaseButton } from "@/components/marginalia/AddToCaseButton";
import { linkifyAndHighlight } from "@/lib/auto-link-citations";

// ── Legal body parser ────────────────────────────────────────────────────────
// Splits body_text into paragraphs and detects (a)/(1)/(i) paragraph labels,
// rendering three indent levels without touching the source data.

type LegalParagraph = {
  label: string | null; // "(a)", "(1)", "(ii)", or null for unlabeled text
  level: 0 | 1 | 2 | 3;
  text: string;
};

function labelLevel(inner: string): 0 | 1 | 2 | 3 {
  if (/^\d+$/.test(inner)) return 2; // (1), (2), …
  // Multi-char roman numerals are unambiguous level 3
  if (/^(ii|iii|iv|vi{0,3}|ix|xi{0,3}|xiv|xv)$/i.test(inner)) return 3;
  // Single letter (including "i", "v", "x" treated as letter-level)
  if (/^[a-z]$/i.test(inner)) return 1;
  return 0;
}

function parseLegalBody(text: string): LegalParagraph[] {
  const out: LegalParagraph[] = [];
  let current = "";

  const flush = () => {
    const para = current.trim();
    if (!para) return;
    // Check for a leading paragraph label: "(a)", "(1)", "(iv)", etc.
    const m = para.match(/^\(([a-zA-Z0-9]{1,4})\)\s*/);
    if (m) {
      const level = labelLevel(m[1]);
      out.push({ label: `(${m[1]})`, level: level || 1, text: para.slice(m[0].length) });
    } else {
      out.push({ label: null, level: 0, text: para });
    }
    current = "";
  };

  // Most source bodies arrive as one giant blob with no newlines. Normalize
  // by inserting a break before every inline enumerator like "(a)", "(1)",
  // "(iv)" — but only when it sits between whitespace, so cross-references
  // like "section 1983(a)(2)" or "Pub. L. 93-579" stay intact.
  const normalized = text.replace(
    /([^\s(])\s+(?=\([a-zA-Z0-9]{1,4}\)\s)/g,
    "$1\n",
  );

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
    } else if (/^\([a-zA-Z0-9]{1,4}\)/.test(trimmed) && current.trim()) {
      // A new labeled paragraph starts — flush the current one first
      flush();
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  flush();
  return out;
}

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
    <div className="mb-6 rounded-2xl border border-border/60 bg-card/60 paper-grain">
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

function LegalBody({ text, q, citations }: { text: string; q?: string; citations: DocCitationRow[] }) {
  const paragraphs = useMemo(() => parseLegalBody(text), [text]);
  const markRe = useMemo(() => {
    if (!q?.trim()) return null;
    const terms = q.trim().split(/\s+/).filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return terms.length ? new RegExp(`(${terms.join("|")})`, "ig") : null;
  }, [q]);

  function renderText(content: string) {
    return linkifyAndHighlight(content, citations, markRe);
  }

  return (
    <div className="space-y-2.5">
      {paragraphs.map((p, i) => (
        <div key={i} id={`para-${i}`} className={`flex gap-3 ${LEVEL_INDENT[p.level]}`}>
          {p.label && (
            <span className="shrink-0 w-8 pt-0.5 font-mono text-[11px] leading-relaxed text-foreground/35 select-none">
              {p.label}
            </span>
          )}
          <span className={p.label ? "flex-1" : ""}>{renderText(p.text)}</span>
        </div>
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
    const parent = d.parent_label ?? "";
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
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
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

function DocOutline({ text }: { text: string }) {
  const paragraphs = useMemo(() => parseLegalBody(text), [text]);
  const items = useMemo(
    () => paragraphs.map((p, i) => ({ ...p, idx: i })).filter((p) => p.level === 1 && p.label),
    [paragraphs],
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
              <span className="mt-0.5 shrink-0 font-mono text-[9px] text-foreground/40">{p.label}</span>
              <span className="line-clamp-2">{p.text.length > 55 ? p.text.slice(0, 55) + "…" : p.text}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

function DocumentPage() {
  const { document, citations, incoming, prev, next, sources } = Route.useLoaderData();
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

  if (!document) return null;

  const internal = citations.filter((c: DocCitationRow) => c.to_document_id);
  const external = citations.filter((c: DocCitationRow) => !c.to_document_id);

  // Group internal traces by source for clarity
  const traceBySource = new Map<string, DocCitationRow[]>();
  for (const c of internal) {
    const k = c.target_source ?? "?";
    const arr = traceBySource.get(k) ?? [];
    arr.push(c);
    traceBySource.set(k, arr);
  }

  const fontClass = ["text-[0.95rem]", "text-[1rem]", "text-[1.05rem]", "text-[1.15rem]", "text-[1.25rem]"][fontSize];
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
  const crossSource = incoming.filter((c: IncomingCitation) => c.source !== document.source_code);
  const sameSource = incoming.filter((c: IncomingCitation) => c.source === document.source_code);
  const crossBySource = new Map<string, IncomingCitation[]>();
  for (const c of crossSource) {
    const arr = crossBySource.get(c.source) ?? [];
    arr.push(c);
    crossBySource.set(c.source, arr);
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
                    params={{ _splat: c.to_identifier.replace(/^\//, "") }}
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

  const crossPanel = crossSource.length > 0 ? (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
      <div className="citation-tag text-accent mb-2">
        Cited across {crossBySource.size} other codebook{crossBySource.size !== 1 ? "s" : ""}
      </div>
      <div className="space-y-3">
        {Array.from(crossBySource.entries()).map(([src, items]) => (
          <div key={src}>
            <div className="mb-1 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {SOURCE_NAMES[src] ?? src}
            </div>
            <ul className="space-y-1.5">
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

  const citedByPanel = sameSource.length > 0 ? (
    <div>
      <div className="citation-tag text-accent">
        Cited by {sameSource.length} section{sameSource.length !== 1 ? "s" : ""} in this codebook
      </div>
      <ul className="mt-3 space-y-2">
        {sameSource.map((c: IncomingCitation, i: number) => (
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
  ) : null;

  const graphPlaceholder = (
    <div className="rounded-lg border border-dashed border-border/70 bg-card/30 p-3 text-xs text-foreground/65">
      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
        <Network className="h-3.5 w-3.5" />
        Citation graph
      </div>
      <p className="mt-1 leading-relaxed">
        A visual map of what this section depends on and what depends on it — rendering here once the graph component ships.
      </p>
    </div>
  );

  const rightRail = (
    <div className="space-y-6 text-sm">
      <DocOutline text={document.body_text ?? ""} />
      {tracesPanel}
      {crossPanel}
      {citedByPanel}
      {graphPlaceholder}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="Connections" centerMaxWidth="max-w-3xl">
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
                {document.parent_label ? <> · <span className="text-foreground/70">{document.parent_label}</span></> : null}
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
            <AddToCaseButton
              identifier={document.identifier}
              source_code={document.source_code}
              heading={document.heading}
              section_label={document.section_label}
            />
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
          <DefinitionsPanel text={document.body_text ?? ""} />
          <div className={`font-serif leading-relaxed text-foreground/90 ${fontClass}`}>
            <LegalBody text={document.body_text ?? ""} q={search.q} citations={citations} />
          </div>
        </div>

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

        {/* Citation panels — visible only on screens where the right rail is hidden (< xl). */}
        <div className="mt-12 space-y-10 xl:hidden">
          {tracesPanel}
          {crossPanel}
          {citedByPanel}
        </div>

        {external.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-muted-foreground">
              {external.length} reference{external.length === 1 ? "" : "s"} not yet in our index
            </div>
            <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {external.slice(0, 40).map((c: DocCitationRow, i: number) => (
                <li key={i} className="truncate font-mono text-xs">{c.to_identifier}</li>
              ))}
            </ul>
            {external.length > 40 && (
              <div className="mt-2 text-xs text-muted-foreground">
                + {external.length - 40} more
              </div>
            )}
          </div>
        )}
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
