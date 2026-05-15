import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState, useEffect, useCallback } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { searchDocuments, listSources } from "@/lib/documents.functions";
import { SlidersHorizontal, GitCompare, X, Copy, Check, Network, Languages, Brain, Bell, History, Mic, Wand2, BookmarkPlus, Bookmark, BookmarkCheck } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";
const useLocalState = useState;

const SAVED_KEY = "marginalia_saved_searches";

type SavedSearch = { q: string; source: string; savedAt: string };

function useSavedSearches() {
  const [saved, setSaved] = useState<SavedSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((next: SavedSearch[]) => {
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const save = useCallback((q: string, source: string) => {
    setSaved((prev) => {
      if (prev.some((s) => s.q === q && s.source === source)) return prev;
      const next = [{ q, source, savedAt: new Date().toISOString() }, ...prev].slice(0, 20);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const remove = useCallback((q: string, source: string) => {
    persist(saved.filter((s) => !(s.q === q && s.source === source)));
  }, [saved, persist]);

  const isSaved = useCallback((q: string, source: string) => {
    return saved.some((s) => s.q === q && s.source === source);
  }, [saved]);

  return { saved, save, remove, isSaved };
}

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "").default(""),
  exact: fallback(z.boolean(), false).default(false),
  words: fallback(z.string(), "").default(""),   // comma-separated must-have words
  exclude: fallback(z.string(), "").default(""), // comma-separated excluded words
});

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

const SOURCE_ABBR: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

type Hit = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string;
  exact?: boolean;
  semantic?: boolean;
};

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    q: search.q,
    source: search.source,
    exact: search.exact,
    words: search.words,
    exclude: search.exclude,
  }),
  loader: async ({ deps }) => {
    const sourcesPromise = listSources();
    if (!deps.q || deps.q.trim().length < 2) {
      const { sources } = await sourcesPromise;
      return { hits: [] as Hit[], sources, error: null as string | null };
    }

    // Build websearch-compatible query string.
    // websearch_to_tsquery natively handles: "phrase", -exclude, OR.
    let effectiveQ = deps.q.trim();
    if (deps.exact) effectiveQ = `"${effectiveQ}"`;
    if (deps.words) {
      effectiveQ += " " + deps.words.split(",").map((w) => w.trim()).filter(Boolean).join(" ");
    }
    if (deps.exclude) {
      effectiveQ += " " + deps.exclude.split(",").map((t) => t.trim()).filter(Boolean).map((t) => `-${t}`).join(" ");
    }

    const [{ hits, error }, { sources }] = await Promise.all([
      searchDocuments({ data: { q: effectiveQ.trim(), source: deps.source || undefined } }),
      sourcesPromise,
    ]);

    return { hits: hits ?? [], sources, error };
  },
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string })?.q ?? "";
    const title = q ? `"${q}" · Marginalia search` : "Search · Marginalia";
    const description = q
      ? `Search results for "${q}" across the Constitution, U.S. Code, CFR, UCC, TFM, and IRM.`
      : "Full-text search across the Constitution, United States Code, Code of Federal Regulations, Uniform Commercial Code, and Treasury Financial Manual.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://self-law.org/search" },
      ],
      links: [{ rel: "canonical", href: "https://self-law.org/search" }],
    };
  },
});

// Snippets from ts_headline already contain <mark>…</mark> tags.
// Parse them into React elements rather than injecting raw HTML.
function parseSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  const parts = snippet.split(/(<mark>.*?<\/mark>)/i);
  return parts.map((p, i) => {
    const m = p.match(/^<mark>(.*?)<\/mark>$/i);
    return m ? (
      <mark key={i} className="bg-highlight/70 text-ink rounded-sm px-0.5">{m[1]}</mark>
    ) : p;
  });
}

function SearchPage() {
  const { q, source, exact, words, exclude } = Route.useSearch();
  const { hits, sources, error } = Route.useLoaderData();
  const [showFilters, setShowFilters] = useState(!!(exact || words || exclude));
  const { saved, save, remove, isSaved } = useSavedSearches();

  // Group by source
  const bySource = new Map<string, Hit[]>();
  for (const h of hits as Hit[]) {
    const arr = bySource.get(h.source_code) ?? [];
    arr.push(h);
    bySource.set(h.source_code, arr);
  }

  const hasFilters = exact || !!words || !!exclude || !!source;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">full-text search</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {q ? (
            <>
              Results for <span className="ink-underline italic">"{q}"</span>
            </>
          ) : (
            "What do you want to know?"
          )}
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          One index across the Constitution, U.S. Code, Code of Federal Regulations, Uniform Commercial Code,
          and Treasury Financial Manual.
        </p>

        <div className="mt-8">
          <SearchBar autoFocus />
          <p className="mt-2 text-[11px] text-muted-foreground/60">
            Tip: use <code className="font-mono">"exact phrase"</code>, <code className="font-mono">-exclude</code>, or{" "}
            <code className="font-mono">term OR term</code> directly in the search bar.
          </p>
        </div>

        {/* Power search filters */}
        <div className="mt-4">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              hasFilters
                ? "border-sage-deep bg-sage-deep/10 text-sage-deep"
                : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Power filters {hasFilters ? "· active" : ""}
          </button>

          {showFilters && (
            <div className="mt-3 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Exact phrase */}
                <div>
                  <label className="citation-tag text-muted-foreground">exact phrase match</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={exact}
                        onChange={(e) => {
                          const url = new URL(window.location.href);
                          if (e.target.checked) url.searchParams.set("exact", "true");
                          else url.searchParams.delete("exact");
                          window.location.href = url.toString();
                        }}
                      />
                      <div className="peer-checked:bg-sage-deep h-5 w-9 rounded-full bg-muted after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                    <span className="text-xs text-foreground/70">
                      {exact ? "On — matches exact phrase" : "Off — any word order"}
                    </span>
                  </div>
                </div>

                {/* Must include */}
                <div>
                  <label className="citation-tag text-muted-foreground">must include (comma-separated)</label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const val = fd.get("words") as string;
                      const url = new URL(window.location.href);
                      if (val.trim()) url.searchParams.set("words", val.trim());
                      else url.searchParams.delete("words");
                      window.location.href = url.toString();
                    }}
                    className="mt-1.5 flex gap-2"
                  >
                    <input
                      name="words"
                      defaultValue={words}
                      placeholder="e.g. warrant, seizure"
                      className="flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-xs focus:border-foreground/40 focus:outline-none"
                    />
                    <button type="submit" className="rounded-lg bg-foreground/10 px-3 py-1.5 text-xs hover:bg-foreground/15">
                      Apply
                    </button>
                  </form>
                </div>

                {/* Exclude */}
                <div>
                  <label className="citation-tag text-muted-foreground">exclude words (comma-separated)</label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const val = fd.get("exclude") as string;
                      const url = new URL(window.location.href);
                      if (val.trim()) url.searchParams.set("exclude", val.trim());
                      else url.searchParams.delete("exclude");
                      window.location.href = url.toString();
                    }}
                    className="mt-1.5 flex gap-2"
                  >
                    <input
                      name="exclude"
                      defaultValue={exclude}
                      placeholder="e.g. tax, revenue"
                      className="flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-xs focus:border-foreground/40 focus:outline-none"
                    />
                    <button type="submit" className="rounded-lg bg-foreground/10 px-3 py-1.5 text-xs hover:bg-foreground/15">
                      Apply
                    </button>
                  </form>
                </div>

                {/* Compare action */}
                {q && q.trim().length >= 2 && (
                  <div className="flex items-end">
                    <Link
                      to="/compare"
                      search={{ q, sources: source || "usc,cfr" }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sage-deep/40 bg-sage-deep/5 px-3 py-2 text-xs text-sage-deep hover:bg-sage-deep/10 transition-colors"
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      Compare "{q}" side-by-side
                    </Link>
                  </div>
                )}
              </div>

              {hasFilters && (
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("exact");
                    url.searchParams.delete("words");
                    url.searchParams.delete("exclude");
                    window.location.href = url.toString();
                  }}
                  className="mt-3 flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {q && (
          <>
            {/* Source filter tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/search"
                search={{ q, source: "", exact, words, exclude }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                  !source
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/60 hover:border-foreground/40 text-foreground/70 hover:text-foreground"
                }`}
              >
                All
                {!source && hits.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
                    {(hits as Hit[]).length}
                  </span>
                )}
              </Link>
              {(sources as { code: string; name: string; count: number }[]).map((s) => {
                const cnt = (hits as Hit[]).filter((h: Hit) => h.source_code === s.code).length;
                if (cnt === 0 && source !== s.code) return null;
                return (
                  <Link
                    key={s.code}
                    to="/search"
                    search={{ q, source: s.code, exact, words, exclude }}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                      source === s.code
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/60 hover:border-foreground/40 text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    {SOURCE_ABBR[s.code] ?? s.code.toUpperCase()}
                    {cnt > 0 && (
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${source === s.code ? "bg-background/20" : "bg-muted"}`}>
                        {cnt}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Result count banner */}
            {(hits as Hit[]).length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-display font-semibold text-foreground">
                  {(hits as Hit[]).length.toLocaleString()}
                </span>
                <span>
                  {(hits as Hit[]).length === 1 ? "match" : "matches"} across{" "}
                  <span className="font-medium text-foreground">{bySource.size}</span>{" "}
                  {bySource.size === 1 ? "codebook" : "codebooks"}
                </span>
                {(hits as Hit[]).some((h: Hit) => h.semantic) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/8 px-2 py-0.5 text-[10px] font-medium text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    semantic
                  </span>
                )}
                <span className="hidden sm:inline ml-auto font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  indexed May 2026 · direct from source
                </span>
                {/* Save this search */}
                {q && (
                  <button
                    type="button"
                    title={isSaved(q, source) ? "Remove saved search" : "Save this search"}
                    onClick={() => isSaved(q, source) ? remove(q, source) : save(q, source)}
                    className={`ml-auto sm:ml-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                      isSaved(q, source)
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {isSaved(q, source) ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                    {isSaved(q, source) ? "Saved" : "Save"}
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Results */}
            {!error && (hits as Hit[]).length === 0 ? (
              <div className="mt-12 text-center">
                <p className="font-display text-2xl text-foreground/50">No results for "{q}"</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a broader term — <em>due process</em>, <em>1692</em>, <em>oath</em>, <em>seizure</em>.
                </p>
                <Link
                  to="/compare"
                  search={{ q, sources: "usc,cfr,ucc" }}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <GitCompare className="h-4 w-4" />
                  Try compare mode
                </Link>
              </div>
            ) : !source ? (
              /* Grouped by source view */
              <div className="mt-6 space-y-8">
                {Array.from(bySource.entries()).map(([src, srcHits]) => (
                  <div key={src}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="citation-tag text-muted-foreground">
                        {SOURCE_LABELS[src] ?? src.toUpperCase()} · {srcHits.length} match{srcHits.length !== 1 ? "es" : ""}
                      </div>
                      <Link
                        to="/search"
                        search={{ q, source: src, exact, words, exclude }}
                        className="text-xs text-accent hover:underline"
                      >
                        Filter to {SOURCE_ABBR[src] ?? src} →
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {srcHits.slice(0, 5).map((h: Hit) => (
                        <ResultCard key={h.identifier} hit={h} q={q} />
                      ))}
                      {srcHits.length > 5 && (
                        <Link
                          to="/search"
                          search={{ q, source: src, exact, words, exclude }}
                          className="block text-center text-xs text-muted-foreground hover:text-accent py-2"
                        >
                          +{srcHits.length - 5} more in {SOURCE_ABBR[src]}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Single source flat list */
              <div className="mt-6 space-y-3">
                {(hits as Hit[]).map((h: Hit) => (
                  <ResultCard key={h.identifier} hit={h} q={q} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Saved searches — shown when idle */}
        {!q && saved.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-muted-foreground mb-3 flex items-center gap-1.5">
              <Bookmark className="h-3 w-3" />
              Saved searches
            </div>
            <ul className="space-y-2">
              {saved.map((s) => (
                <li key={`${s.q}::${s.source}`} className="group flex items-center gap-2">
                  <Link
                    to="/search"
                    search={{ q: s.q, source: s.source, exact: false, words: "", exclude: "" }}
                    className="flex-1 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm hover:border-foreground/20 hover:bg-muted/60 transition-all"
                  >
                    <span className="font-medium text-foreground">{s.q}</span>
                    {s.source && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        in {SOURCE_ABBR[s.source] ?? s.source.toUpperCase()}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => remove(s.q, s.source)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Vision: what search will become */}
        <div className="mt-20">
          <ComingSoonHeader
            eyebrow="search, but smarter"
            title="The kind of search the law actually deserves."
            subtitle="Right now you get fast keyword + phrase matching across six federal codebooks. Here's where this is going — every tile below is on the build list."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ComingSoonCard
              icon={Brain}
              status="live"
              title="Ask in plain English"
              pitch="Type a full question and semantic search finds the statutes that answer it — even when the exact words don't appear. Just ask."
            />
            <ComingSoonCard
              icon={Network}
              status="soon"
              title="Citation graph"
              pitch="Every result shows what cites it and what it cites — across codebooks. Walk a regulation back to the statute that authorized it, then forward to every CFR rule built on top."
            />
            <ComingSoonCard
              icon={Languages}
              status="building"
              title="Plain-English layer"
              pitch="A toggle that rewrites any section in everyday language, side-by-side with the original text. The law stays the law — you just get a translator."
            />
            <ComingSoonCard
              icon={History}
              status="soon"
              title="Time-travel any section"
              pitch="Slide through every version of a statute or regulation back to its enactment. See exactly what changed, when, and which Public Law did it."
            />
            <ComingSoonCard
              icon={Wand2}
              status="vision"
              title="Smart filter chips"
              pitch="Search 'eviction' and we surface the right filter chips for you — by state, by type of housing, by stage of the process — so you're not guessing the magic words."
            />
            <ComingSoonCard
              icon={Bell}
              status="soon"
              title="Save searches & get alerts"
              pitch="Pin a query and we'll ping you when a new amendment, regulation, or agency manual update changes the answer. Set it once, stop re-googling."
            />
            <ComingSoonCard
              icon={Mic}
              status="vision"
              title="Read-aloud + voice ask"
              pitch="Tap to hear any section read in a clean voice. Or hold the mic and ask a question — the answer comes back as cited text you can scroll through."
            />
            <ComingSoonCard
              icon={BookmarkPlus}
              status="building"
              title="Threads across codebooks"
              pitch="Save a result and we'll auto-suggest the connected sections you'd want next — the regulation that implements it, the agency manual that enforces it, the case law that's interpreted it."
            />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            None of this is live yet — but every piece is on the bench.{" "}
            <Link to="/whitepaper" className="text-accent hover:underline">
              See the full roadmap →
            </Link>
          </p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

const CITATION_FORMATS: Record<string, (id: string, heading: string) => string> = {
  usc: (id, heading) => `${id}, ${heading} (U.S.C.)`,
  cfr: (id, heading) => `${id} C.F.R. — ${heading}`,
  const: (id, heading) => `U.S. Const. ${heading} (${id})`,
  ucc: (id, heading) => `U.C.C. ${id} — ${heading}`,
  tfm: (id, heading) => `TFM ${id} — ${heading}`,
  irm: (id, heading) => `IRM ${id} — ${heading}`,
};

function buildCitation(hit: Hit): string {
  const fmt = CITATION_FORMATS[hit.source_code];
  const heading = hit.heading || hit.section_label || hit.identifier;
  if (fmt) return fmt(hit.identifier, heading);
  return `${hit.identifier} — ${heading}`;
}

function ResultCard({ hit, q }: { hit: Hit; q: string }) {
  const [copied, setCopied] = useLocalState(false);

  function handleCite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const citation = buildCitation(hit);
    navigator.clipboard.writeText(citation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card paper-grain shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[var(--shadow-warm)]">
      <Link
        to="/code/$"
        params={{ _splat: hit.identifier.replace(/^\//, "") }}
        search={{ q: q || undefined }}
        className="block p-5"
      >
        <div className="flex flex-wrap items-start gap-2">
          <span className="citation-tag rounded-full border border-foreground/20 px-2 py-0.5 text-foreground/60 shrink-0">
            {SOURCE_ABBR[hit.source_code] ?? hit.source_code.toUpperCase()}
          </span>
          {hit.parent_label && (
            <span className="citation-tag text-muted-foreground/70">{hit.parent_label}</span>
          )}
          {hit.section_label && (
            <span className="citation-tag text-muted-foreground/70">{hit.section_label}</span>
          )}
          {hit.exact && (
            <span className="citation-tag rounded-full bg-highlight/50 px-2 py-0.5 text-ochre">exact</span>
          )}
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground">
          {hit.heading || hit.section_label || hit.identifier}
        </h3>
        {hit.snippet && (
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/65 line-clamp-3">
            {parseSnippet(hit.snippet)}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <code className="font-mono text-[11px] text-muted-foreground/60">{hit.identifier}</code>
          <span className="ml-auto text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
            Read →
          </span>
        </div>
      </Link>
      {/* Cite button — floats top-right, only on hover */}
      <button
        onClick={handleCite}
        title="Copy citation"
        className={`absolute right-3 top-3 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
          copied
            ? "border-green-500/40 bg-green-500/10 text-green-600 opacity-100"
            : "border-border/60 bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:border-foreground/30 hover:text-foreground"
        }`}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Cite"}
      </button>
    </div>
  );
}
