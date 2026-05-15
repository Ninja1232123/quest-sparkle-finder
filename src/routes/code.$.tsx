import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, type DocCitationRow, type IncomingCitation } from "@/lib/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Plus } from "lucide-react";
import { AddToCaseButton } from "@/components/marginalia/AddToCaseButton";
import { linkifyAndHighlight, parseGlossary } from "@/lib/auto-link-citations";

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

  for (const line of text.split("\n")) {
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

function LegalBody({ text, q, citations, glossary }: {
  text: string;
  q?: string;
  citations: DocCitationRow[];
  glossary?: Map<string, string>;
}) {
  const paragraphs = useMemo(() => parseLegalBody(text), [text]);
  const markRe = useMemo(() => {
    if (!q?.trim()) return null;
    const terms = q.trim().split(/\s+/).filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return terms.length ? new RegExp(`(${terms.join("|")})`, "ig") : null;
  }, [q]);

  function renderText(content: string) {
    return linkifyAndHighlight(content, citations, markRe, glossary);
  }

  return (
    <div className="space-y-2.5">
      {paragraphs.map((p, i) => (
        <div key={i} className={`flex gap-3 ${LEVEL_INDENT[p.level]}`}>
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
    const res = await getDocument({ data: { identifier } });
    if (!res.document) throw notFound();
    return res;
  },
  component: DocumentPage,
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </article>
      <SiteFooter />
    </div>
  ),
  head: ({ loaderData }) => {
    const d = loaderData?.document;
    if (!d) return { meta: [{ title: "Not found · Marginalia" }] };
    const title = `${d.section_label ?? ""} ${d.heading ?? ""}`.trim();
    return {
      meta: [
        { title: `${title} — ${d.parent_label ?? ""} · Marginalia` },
        { name: "description", content: (d.body_text ?? "").slice(0, 155) },
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

function DocumentPage() {
  const { document, citations, incoming, prev, next, glossaryText } = Route.useLoaderData();
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

  const glossary = useMemo(() => parseGlossary(glossaryText ?? null), [glossaryText]);

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

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Sticky breadcrumb / utility bar */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-2.5">
          <div className="citation-tag min-w-0 flex-1 truncate text-muted-foreground">
            <Link to="/code" className="hover:text-foreground">Code</Link>
            {" · "}
            <Link to="/code/source/$source" params={{ source: document.source_code }} className="hover:text-foreground">
              {SOURCE_NAMES[document.source_code] ?? document.source_code.toUpperCase()}
            </Link>
            {document.parent_label ? <> · <span className="text-foreground/70">{document.parent_label}</span></> : null}
            {document.section_label ? <> · <span className="text-foreground/70">{document.section_label}</span></> : null}
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

      <article className="mx-auto max-w-3xl px-6 py-12">
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

        {glossary.size > 0 && (
          <p className="mt-6 text-[11px] text-muted-foreground/50">
            <span className="underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">Dotted underlines</span>{" "}
            are defined terms — hover to see the definition from §{" "}
            {document.parent_label ?? document.source_code}.
          </p>
        )}
        <div className={`mt-8 font-serif leading-relaxed text-foreground/90 ${fontClass}`}>
          <LegalBody text={document.body_text ?? ""} q={search.q} citations={citations} glossary={glossary.size > 0 ? glossary : undefined} />
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

        {internal.length > 0 && (
          <div className="mt-12">
            <div className="citation-tag text-accent">
              Traces to {internal.length} document{internal.length === 1 ? "" : "s"}
            </div>
            <div className="mt-3 space-y-6">
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
                          className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                        >
                          <div className="font-display text-sm font-semibold">
                            {c.target_heading || c.to_identifier}
                          </div>
                          <div className="citation-tag mt-0.5 text-muted-foreground">
                            {c.target_section_label ?? c.to_identifier}
                          </div>
                          {c.context_snippet && (
                            <p className="mt-1.5 font-serif text-xs text-muted-foreground/70 line-clamp-2 italic">
                              "{c.context_snippet}"
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

          {/* Cross-codebook panel: incoming citations from a different source */}
          {(() => {
            const crossSource = incoming.filter((c: IncomingCitation) => c.source !== document.source_code);
            if (crossSource.length === 0) return null;
            const bySource = new Map<string, IncomingCitation[]>();
            for (const c of crossSource) {
              const arr = bySource.get(c.source) ?? [];
              arr.push(c);
              bySource.set(c.source, arr);
            }
            return (
              <div className="mt-10 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
                <div className="citation-tag text-accent mb-3">
                  Cited across {bySource.size} other codebook{bySource.size !== 1 ? "s" : ""}
                </div>
                <div className="space-y-4">
                  {Array.from(bySource.entries()).map(([src, items]) => (
                    <div key={src}>
                      <div className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {SOURCE_NAMES[src] ?? src}
                      </div>
                      <ul className="space-y-1.5">
                        {items.map((c: IncomingCitation, i: number) => (
                          <li key={i}>
                            <Link
                              to="/code/$"
                              params={{ _splat: c.identifier.replace(/^\//, "") }}
                              className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                            >
                              <div className="citation-tag text-muted-foreground">
                                {c.section_label ?? c.identifier}
                              </div>
                              <div className="font-display text-sm font-semibold">{c.heading}</div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Same-source "Cited by" */}
          {incoming.filter((c: IncomingCitation) => c.source === document.source_code).length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-accent">
              Cited by {incoming.filter((c: IncomingCitation) => c.source === document.source_code).length} section{incoming.filter((c: IncomingCitation) => c.source === document.source_code).length !== 1 ? "s" : ""} in this codebook
            </div>
            <ul className="mt-3 space-y-2">
              {incoming.filter((c: IncomingCitation) => c.source === document.source_code).map((c: IncomingCitation, i: number) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.identifier.replace(/^\//, "") }}
                    className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                  >
                    <div className="citation-tag text-muted-foreground">
                      {c.section_label ?? c.identifier}
                    </div>
                    <div className="font-display text-sm font-semibold">{c.heading}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

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

      <SiteFooter />
    </div>
  );
}
