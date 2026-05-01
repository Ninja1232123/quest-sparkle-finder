import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { searchDocuments, listSources } from "@/server/documents.functions";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "").default(""),
});

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ q: search.q, source: search.source }),
  loader: async ({ deps }) => {
    const sourcesPromise = listSources();
    if (!deps.q || deps.q.trim().length < 2) {
      const { sources } = await sourcesPromise;
      return { hits: [], sources, error: null as string | null };
    }
    const [{ hits, error }, { sources }] = await Promise.all([
      searchDocuments({ data: { q: deps.q.trim(), source: deps.source || undefined } }),
      sourcesPromise,
    ]);
    return { hits, sources, error };
  },
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string })?.q ?? "";
    return {
      meta: [
        { title: q ? `"${q}" · Marginalia search` : "Search · Marginalia" },
        {
          name: "description",
          content:
            "Full-text search across the Constitution, United States Code, Code of Federal Regulations, Uniform Commercial Code, and Treasury Financial Manual.",
        },
      ],
    };
  },
});

function SearchPage() {
  const { q, source } = Route.useSearch();
  const { hits, sources, error } = Route.useLoaderData();

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
          One index across the Constitution, U.S. Code, Code of Federal Regulations, Uniform Commercial
          Code, and Treasury Financial Manual.
        </p>

        <div className="mt-8">
          <SearchBar autoFocus />
        </div>

        {q && (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/search"
                search={{ q, source: "" }}
                className={`citation-tag rounded-full border px-3 py-1 ${
                  !source
                    ? "border-foreground/40 bg-foreground text-background"
                    : "border-border hover:border-foreground/40"
                }`}
              >
                All sources
              </Link>
              {sources.map((s) => (
                <Link
                  key={s.code}
                  to="/search"
                  search={{ q, source: s.code }}
                  className={`citation-tag rounded-full border px-3 py-1 ${
                    source === s.code
                      ? "border-foreground/40 bg-foreground text-background"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {SOURCE_LABELS[s.code] ?? s.name} · {s.count.toLocaleString()}
                </Link>
              ))}
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              {error ? (
                <p>Couldn't run that search — {error}</p>
              ) : hits.length === 0 ? (
                <p>
                  Nothing matched. Try a broader phrase — <em>due process</em>, <em>warranty</em>,{" "}
                  <em>1692</em>, or <em>oath</em>.
                </p>
              ) : (
                <p>
                  {hits.length} match{hits.length === 1 ? "" : "es"}
                  {source ? ` in ${SOURCE_LABELS[source] ?? source.toUpperCase()}` : " across all sources"}.
                </p>
              )}
            </div>

            {hits.length > 0 && (
              <ul className="mt-6 space-y-3">
                {hits.map((h) => (
                  <li key={h.identifier}>
                    <Link
                      to="/code/$"
                      params={{ _splat: h.identifier.replace(/^\//, "") }}
                      className="block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="citation-tag rounded-full border border-foreground/20 px-2 py-0.5 text-foreground/70">
                          {(SOURCE_LABELS[h.source_code] ?? h.source_code).toString()}
                        </span>
                        {h.parent_label && (
                          <span className="citation-tag text-muted-foreground">{h.parent_label}</span>
                        )}
                        {h.section_label && (
                          <span className="font-mono text-xs text-foreground/70">{h.section_label}</span>
                        )}
                      </div>
                      <div className="mt-1 font-display text-base font-semibold">
                        {h.heading ?? h.section_label ?? h.identifier}
                      </div>
                      {h.snippet && (
                        <p className="mt-2 text-sm text-foreground/75">{h.snippet}…</p>
                      )}
                      <div className="mt-2 font-mono text-[11px] text-muted-foreground">{h.identifier}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {!q && (
          <div className="mt-10">
            <div className="citation-tag text-muted-foreground">indexed sources</div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {sources.map((s) => (
                <li key={s.code}>
                  <Link
                    to="/code/source/$source"
                    params={{ source: s.code }}
                    className="block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="citation-tag text-accent">{s.count.toLocaleString()} documents</div>
                    <div className="mt-1 font-display text-lg font-semibold">
                      {SOURCE_LABELS[s.code] ?? s.name}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
