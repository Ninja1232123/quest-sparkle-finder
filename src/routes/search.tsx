import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { SearchSyntax } from "@/components/marginalia/SearchSyntax";
import { searchDocuments, listSources } from "@/lib/documents.functions";
import { getOpinionsIndex, type OpinionListItem } from "@/lib/opinions.functions";
import { formatGroupCrumb } from "@/lib/label-format";
import { STATE_NAMES } from "@/lib/source-groups";
import { useAuth } from "@/hooks/use-auth";
import { useSearchQuota, FREE_DAILY_LIMIT } from "@/hooks/use-search-quota";
import { SlidersHorizontal, GitCompare, X, Copy, Check, Network, Languages, Brain, Bell, History, Mic, Wand2, BookmarkPlus, Lock, Scale } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";
const useLocalState = useState;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "").default(""),
  exact: fallback(z.boolean(), false).default(false),
  words: fallback(z.string(), "").default(""),   // comma-separated must-have words
  exclude: fallback(z.string(), "").default(""), // comma-separated excluded words
  scope: fallback(z.enum(["codified", "primary", "states", "cases"]), "codified").default("codified"),
});

// The three search buckets. Default lands on the codified law; the bulky
// primary sources and (forthcoming) caselaw are opt-in, so a plain search
// isn't 41% Federal Register. `sources` lists which source_codes belong to each
// — used to label tabs; the backend enforces the same split via p_scope.
const SCOPES = [
  { key: "codified", label: "Codified law", blurb: "Constitution, U.S. Code, CFR, UCC, Treasury & IRS manuals", sources: ["const", "usc", "cfr", "ucc", "tfm", "irm"] },
  { key: "primary", label: "Primary sources", blurb: "Federal Register, Statutes at Large, bills & presidential papers", sources: ["register", "statutes-at-large", "bill", "public-papers-president", "statute-compilations", "public-private-law"] },
  { key: "states", label: "State law", blurb: "All 50 states' statutes & constitutions — or pick one", sources: [] },
  { key: "cases", label: "Court cases", blurb: "~28,500 Supreme Court opinions, full text, searchable by case name", sources: [] },
] as const;

// State-law jurisdiction picker: people want either all states or their one
// state, so this is a single toggle (the <select>), not 50 scope tabs. Value ""
// = all states; a state code pins that one. DC has no corpus yet, so it's out.
const STATE_OPTIONS = Object.entries(STATE_NAMES)
  .filter(([code]) => code !== "dc")
  .sort((a, b) => a[1].localeCompare(b[1]));

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
  register: "Federal Register",
  "statutes-at-large": "Statutes at Large",
  bill: "Congressional Bills",
  "public-papers-president": "Public Papers of the Presidents",
  "statute-compilations": "Statute Compilations",
  "public-private-law": "Public & Private Laws",
};

const SOURCE_ABBR: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
  register: "Fed. Reg.",
  "statutes-at-large": "Stat.",
  bill: "Bill",
  "public-papers-president": "Pres. Papers",
  "statute-compilations": "Stat. Comp.",
  "public-private-law": "Pub. L.",
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
  trgm?: boolean;
};

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    q: search.q,
    source: search.source,
    exact: search.exact,
    words: search.words,
    exclude: search.exclude,
    scope: search.scope,
  }),
  loader: async ({ deps }) => {
    const sourcesPromise = listSources();

    if (deps.scope === "cases") {
      const { sources } = await sourcesPromise;
      if (!deps.q || deps.q.trim().length < 2) {
        return { hits: [] as Hit[], sources, error: null as string | null, opinions: [] as OpinionListItem[], opinionTotal: 0 };
      }
      const { items, total } = await getOpinionsIndex({ data: { q: deps.q.trim(), page: 0 } });
      return { hits: [] as Hit[], sources, error: null as string | null, opinions: items, opinionTotal: total };
    }

    if (!deps.q || deps.q.trim().length < 2) {
      const { sources } = await sourcesPromise;
      return { hits: [] as Hit[], sources, error: null as string | null, opinions: [] as OpinionListItem[], opinionTotal: 0 };
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
      searchDocuments({ data: { q: effectiveQ.trim(), source: deps.source || undefined, scope: deps.scope } }),
      sourcesPromise,
    ]);

    return { hits: hits ?? [], sources, error, opinions: [] as OpinionListItem[], opinionTotal: 0 };
  },
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string })?.q ?? "";
    const title = q ? `"${q}" · Self-Law search` : "Search · Self-Law";
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
  const { q, source, exact, words, exclude, scope } = Route.useSearch();
  const { hits, sources, error, opinions, opinionTotal } = Route.useLoaderData();
  const navigate = useNavigate();

  // ── Freemium gate (the single enforcement point for ALL search paths) ──
  // Viewing a results page requires sign-in; free users get FREE_DAILY_LIMIT/day.
  // Auth/quota are client-side (cloud session + localStorage), so the gate runs
  // on mount. SearchBar/⌘K only pre-check (no consume) — we count once here.
  const { user, loading: authLoading } = useAuth();
  const { isPro, consume } = useSearchQuota();
  const trimmed = q.trim();
  const consumedFor = useRef<string | null>(null);
  const isCases = scope === "cases";
  const needsAuth = !authLoading && !user && trimmed.length >= 2;

  useEffect(() => {
    if (authLoading || trimmed.length < 2) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/search?q=${encodeURIComponent(trimmed)}` } });
      return;
    }
    if (isPro) return;
    if (consumedFor.current === trimmed) return; // don't re-count filter/source changes
    if (consume()) consumedFor.current = trimmed;
    else navigate({ to: "/subscribe" });
  }, [trimmed, user, authLoading, isPro, consume, navigate, isCases]);

  // Group by source
  const bySource = new Map<string, Hit[]>();
  for (const h of hits as Hit[]) {
    const arr = bySource.get(h.source_code) ?? [];
    arr.push(h);
    bySource.set(h.source_code, arr);
  }

  const hasFilters = exact || !!words || !!exclude || !!source;

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <SlidersHorizontal className="h-3 w-3" />
          refine
          {hasFilters && (
            <span className="ml-auto rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent">
              active
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-3">
          {/* Exact phrase */}
          <div>
            <label className="citation-tag text-muted-foreground">exact phrase</label>
            <div className="mt-1 flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={exact}
                  onChange={(e) => {
                    navigate({ to: "/search", search: { q, source, exact: e.target.checked, words, exclude, scope } });
                  }}
                />
                <div className="peer-checked:bg-accent h-5 w-9 rounded-full bg-muted after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
              <span className="text-xs text-foreground/65">
                {exact ? "matches exact phrase" : "any word order"}
              </span>
            </div>
          </div>

          {/* Must include */}
          <div>
            <label htmlFor="search-words" className="citation-tag text-muted-foreground">must include</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = (new FormData(e.currentTarget).get("words") as string).trim();
                navigate({ to: "/search", search: { q, source, exact, words: val, exclude, scope } });
              }}
              className="mt-1 flex gap-1.5"
            >
              <input
                id="search-words"
                name="words"
                defaultValue={words}
                placeholder="warrant, seizure"
                className="flex-1 rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs focus:border-foreground/40 focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-foreground/10 px-2 py-1 text-xs hover:bg-foreground/15">Apply</button>
            </form>
          </div>

          {/* Exclude */}
          <div>
            <label htmlFor="search-exclude" className="citation-tag text-muted-foreground">exclude</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = (new FormData(e.currentTarget).get("exclude") as string).trim();
                navigate({ to: "/search", search: { q, source, exact, words, exclude: val, scope } });
              }}
              className="mt-1 flex gap-1.5"
            >
              <input
                id="search-exclude"
                name="exclude"
                defaultValue={exclude}
                placeholder="tax, revenue"
                className="flex-1 rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs focus:border-foreground/40 focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-foreground/10 px-2 py-1 text-xs hover:bg-foreground/15">Apply</button>
            </form>
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                navigate({ to: "/search", search: { q, source, exact: false, words: "", exclude: "", scope } });
              }}
              className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {q && q.trim().length >= 2 && (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">cross-reference</div>
          <Link
            to="/compare"
            search={{ q, sources: source || "usc,cfr" }}
            className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent hover:bg-accent/10 transition-colors"
          >
            <GitCompare className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Compare "{q}" side-by-side</span>
          </Link>
        </div>
      )}

      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">soon · here</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card/30 p-3 text-xs text-foreground/65">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Network className="h-3.5 w-3.5" />
            Citation graph for results
          </div>
          <p className="mt-1 leading-relaxed">
            How matched sections relate to each other — clusters across codebooks, which authority depends on which.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="Refine" centerMaxWidth="max-w-4xl">
      <section>
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
          <SearchSyntax defaultOpen={!q} />
        </div>

        {/* Scope buckets — which body of law to search. Default is the codified
            law; primary sources and caselaw are opt-in. Switching scope resets
            the source filter (sources differ per scope). */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {SCOPES.map((sc) => {
            const active = scope === sc.key;
            return (
              <Link
                key={sc.key}
                to="/search"
                search={{ q, source: "", exact, words, exclude, scope: sc.key }}
                title={sc.blurb}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                  active
                    ? "border-accent bg-accent/10 font-medium text-accent"
                    : "border-border/60 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {sc.label}
              </Link>
            );
          })}
          <span className="ml-1 hidden text-xs text-muted-foreground/60 lg:inline">
            {SCOPES.find((s) => s.key === scope)?.blurb}
          </span>
        </div>

        {/* State-law jurisdiction toggle: all states, or pin one. */}
        {scope === "states" && (
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="state-pick" className="citation-tag text-muted-foreground">
              jurisdiction
            </label>
            <select
              id="state-pick"
              value={source}
              onChange={(e) =>
                navigate({ to: "/search", search: { q, source: e.target.value, exact, words, exclude, scope } })
              }
              className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-foreground/40 focus:border-accent focus:outline-none"
            >
              <option value="">All states</option>
              {STATE_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Court cases — opinion search results */}
        {isCases && !needsAuth && (
          <div className="mt-6">
            {q && trimmed.length >= 2 && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-display font-semibold text-foreground">{opinionTotal.toLocaleString()}</span>
                <span>{opinionTotal === 1 ? "opinion" : "opinions"} matching case name</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  SCOTUS · public domain · full text
                </span>
              </div>
            )}
            {q && trimmed.length >= 2 && opinions.length === 0 && (
              <div className="mt-12 text-center">
                <p className="font-display text-2xl text-foreground/50">No opinions matching "{q}"</p>
                <p className="mt-2 text-sm text-muted-foreground">Search by case name — try <em>Miranda</em>, <em>Brown</em>, <em>Chevron</em>.</p>
              </div>
            )}
            <div className="space-y-2">
              {(opinions as OpinionListItem[]).map((op) => (
                <OpinionCard key={op.slug} op={op} />
              ))}
            </div>
            {!q || trimmed.length < 2 ? (
              <div className="mt-10 text-center">
                <Scale className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-3 font-display text-lg font-semibold">Search 28,500 Supreme Court opinions</p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  Search by case name — <em>Miranda v. Arizona</em>, <em>Marbury v. Madison</em>, <em>Roe v. Wade</em>. Full opinion text opens in the reader.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Signed-out visitor with a query — hide results, the effect bounces
            them to sign-up. Shown briefly (or if JS redirect is slow). */}
        {needsAuth && (
          <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 p-8 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <h2 className="mt-3 font-display text-xl font-semibold">Create a free account to search</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              {FREE_DAILY_LIMIT} searches a day, free — across every codebook. Takes a few seconds.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup", redirect: `/search?q=${encodeURIComponent(trimmed)}` }}
              className="mt-4 inline-flex items-center rounded-full border border-foreground/20 bg-foreground px-5 py-2 font-display text-sm text-background hover:opacity-90"
            >
              Sign up free →
            </Link>
          </div>
        )}

        {!isCases && q && !needsAuth && (
          <>
            {/* Source filter tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/search"
                search={{ q, source: "", exact, words, exclude, scope }}
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
                    search={{ q, source: s.code, exact, words, exclude, scope }}
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
                {(hits as Hit[]).some((h: Hit) => h.trgm) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-ochre/30 bg-ochre/8 px-2 py-0.5 text-[10px] font-medium text-ochre" title="Fuzzy match — no exact keyword hits found, showing closest results">
                    <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
                    fuzzy match
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  direct from source · verify against the official text
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Fuzzy-match callout */}
            {(hits as Hit[]).some((h: Hit) => h.trgm) && (
              <div className="mt-4 rounded-xl border border-ochre/25 bg-ochre/5 px-4 py-2.5 text-sm text-foreground/70">
                No exact keyword matches — showing closest results by spelling similarity.{" "}
                <button
                  onClick={() => navigate({ to: "/search", search: { q: "", source, exact, words, exclude, scope } })}
                  className="text-accent hover:underline"
                >
                  Try a broader search.
                </button>
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
                        search={{ q, source: src, exact, words, exclude, scope }}
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
                          search={{ q, source: src, exact, words, exclude, scope }}
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

        {/* Vision: what search will become */}
        <div className="mt-20">
          <ComingSoonHeader
            eyebrow="how search works here"
            title="Where it's written — everywhere it's written."
            subtitle="Search is straight keyword + phrase retrieval across the whole corpus — every federal codebook and all 50 states — grouped by source so you see every place a term appears, then filter to the codebook you want. No black-box ranking; relevance is yours to drive. Here's what's still on the bench."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ComingSoonCard
              icon={Brain}
              status="live"
              title="Ask Juri in plain English"
              pitch="Keyword search shows you where a term appears. When you'd rather ask a real question — 'can they do this?' — Juri reads the statutes and answers with citations. Conceptual, plain-English search lives there, grounded in the same corpus."
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
              status="live"
              title="Threads across codebooks"
              pitch="Open any document and see what cites it — sorted by codebook. A USC section shows the CFR rules built on it; a CFR rule traces back to the statute that authorized it."
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
    </ResearchShell>
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

function OpinionCard({ op }: { op: OpinionListItem }) {
  return (
    <Link
      to="/record/$slug"
      params={{ slug: op.slug }}
      className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[var(--shadow-warm)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {op.us_cite && (
            <span className="citation-tag rounded-full border border-foreground/20 px-2 py-0.5 text-foreground/60 shrink-0">
              {op.us_cite}
            </span>
          )}
          {op.year && (
            <span className="citation-tag text-muted-foreground/70">{op.year}</span>
          )}
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground">
          {op.case_title}
        </h3>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
        {op.cited_count > 0 && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            {op.cited_count.toLocaleString()} cites
          </span>
        )}
        <span className="text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Read →
        </span>
      </div>
    </Link>
  );
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
            <span className="citation-tag text-muted-foreground/70">
              {formatGroupCrumb(hit.source_code, hit.parent_label)}
            </span>
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
