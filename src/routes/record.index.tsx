import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { listSources } from "@/lib/documents.functions";
import { getOpinionsIndex, OPINIONS_PAGE } from "@/lib/opinions.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Scale, Search as SearchIcon, ChevronRight, ChevronLeft } from "lucide-react";

type SearchParams = { q?: string; decade?: number; letter?: string; page?: number };

const DECADES = Array.from({ length: 23 }, (_, i) => 1790 + i * 10); // 1790s–2010s
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const Route = createFileRoute("/record/")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    decade: s.decade != null && s.decade !== "" ? Number(s.decade) : undefined,
    letter: typeof s.letter === "string" && s.letter ? s.letter : undefined,
    page: s.page != null && s.page !== "" ? Number(s.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [{ sources }, res] = await Promise.all([listSources(), getOpinionsIndex({ data: deps })]);
    return { sources, ...res, search: deps };
  },
  component: RecordIndex,
  head: () => ({
    meta: [
      { title: "Court Record — Supreme Court opinions · Self-Law" },
      {
        name: "description",
        content:
          "Browse and search the full text of U.S. Supreme Court opinions — public-domain decisions organized by era and citation. Read the record itself.",
      },
      { property: "og:title", content: "Court Record — Supreme Court opinions · Self-Law" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/record" }],
  }),
});

function RecordIndex() {
  const { sources, items, total, page, search } = Route.useLoaderData();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const lastPage = Math.max(0, Math.ceil(total / OPINIONS_PAGE) - 1);

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <header className="mb-6">
        <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
          <Scale className="h-3.5 w-3.5" /> Court Record
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Supreme Court opinions</h1>
        <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
          The full text of {total.toLocaleString()} public-domain U.S. Supreme Court opinions — the record itself, not a
          summary. Search by case name, or browse by era.
        </p>
      </header>

      {/* search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/record", search: { q: q.trim() || undefined } });
        }}
        className="mb-5 flex items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by case name — e.g. “Baker v. Carr”"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 font-display text-[15px] outline-none focus:border-ochre"
          />
        </div>
        <button type="submit" className="shrink-0 rounded-xl bg-foreground px-4 py-2.5 font-display text-sm font-semibold text-background hover:opacity-90">
          Search
        </button>
      </form>

      {/* era + A–Z filters */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Link to="/record" search={{}} className={`rounded-full border px-3 py-1 text-[12px] ${!search.decade && !search.letter && !search.q ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border hover:bg-muted/60"}`}>
          All
        </Link>
        {DECADES.map((d) => (
          <Link key={d} to="/record" search={{ decade: d }} className={`rounded-full border px-3 py-1 text-[12px] tabular-nums ${search.decade === d ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border hover:bg-muted/60"}`}>
            {d}s
          </Link>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-1">
        {LETTERS.map((l) => (
          <Link key={l} to="/record" search={{ letter: l }} className={`rounded-md border px-2 py-0.5 text-[12px] font-mono ${search.letter === l ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border hover:bg-muted/60"}`}>
            {l}
          </Link>
        ))}
      </div>

      {/* results */}
      <div className="mb-2 text-[12px] text-muted-foreground">
        {total.toLocaleString()} opinion{total === 1 ? "" : "s"}
        {search.q ? <> matching “{search.q}”</> : search.decade ? <> from the {search.decade}s</> : search.letter ? <> starting with “{search.letter}”</> : <> · most-cited first</>}
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          No opinions match. Try a different name or era.
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
          {items.map((o) => (
            <li key={o.slug}>
              <Link to="/record/$slug" params={{ slug: o.slug }} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-semibold leading-tight">{o.case_title}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {o.us_cite ?? "U.S. Reports"}{o.year ? ` · ${o.year}` : ""}{o.cited_count ? ` · cites ${o.cited_count}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* pagination */}
      {lastPage > 0 && (
        <div className="mt-5 flex items-center justify-between">
          {page > 0 ? (
            <Link to="/record" search={{ ...search, page: page - 1 }} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted/60">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Link>
          ) : <span />}
          <span className="text-[12px] text-muted-foreground">Page {page + 1} of {lastPage + 1}</span>
          {page < lastPage ? (
            <Link to="/record" search={{ ...search, page: page + 1 }} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted/60">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : <span />}
        </div>
      )}
    </ResearchShell>
  );
}
