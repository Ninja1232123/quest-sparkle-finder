import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { getDocument, type DocCitationRow, type IncomingCitation } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Plus } from "lucide-react";
import { AddToCaseButton } from "@/components/marginalia/AddToCaseButton";

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
  const { document, citations, incoming, prev, next } = Route.useLoaderData();
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

  // Highlight ?q= terms in the body without injecting raw HTML.
  const bodyChunks = useMemo(() => {
    const text = document.body_text ?? "";
    const q = (search.q ?? "").trim();
    if (!q || !text) return [{ text, mark: false }];
    const terms = q.split(/\s+/).filter((t) => t.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!terms.length) return [{ text, mark: false }];
    const re = new RegExp(`(${terms.join("|")})`, "ig");
    const out: { text: string; mark: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ text: text.slice(last, i), mark: false });
      out.push({ text: m[0], mark: true });
      last = i + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), mark: false });
    return out;
  }, [document.body_text, search.q]);

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

        <div className={`mt-8 whitespace-pre-wrap font-serif leading-relaxed text-foreground/90 ${fontClass} [&_mark]:bg-highlight [&_mark]:text-foreground [&_mark]:rounded-sm [&_mark]:px-0.5`}>
          {bodyChunks.map((c, i) => c.mark ? <mark key={i}>{c.text}</mark> : <span key={i}>{c.text}</span>)}
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
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

          {incoming.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-accent">
              Cited by {incoming.length} document{incoming.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-3 space-y-2">
                {incoming.map((c: IncomingCitation, i: number) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.identifier.replace(/^\//, "") }}
                    className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                  >
                    <div className="citation-tag text-muted-foreground">
                      {SOURCE_NAMES[c.source] ?? c.source}{c.section_label ? ` · ${c.section_label}` : ""}
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
