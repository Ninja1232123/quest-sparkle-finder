import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listDocumentsBySource } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useMemo, useState } from "react";
import { ChevronDown, Search as SearchIcon, X } from "lucide-react";

const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
};

export const Route = createFileRoute("/code/source/$source")({
  loader: async ({ params }) => {
    const { documents, error } = await listDocumentsBySource({ data: { source: params.source } });
    if (error) throw new Error(error);
    if (documents.length === 0) throw notFound();
    return { documents, source: params.source };
  },
  component: SourceBrowser,
  head: ({ params }) => ({
    meta: [
      { title: `${SOURCE_NAMES[params.source] ?? params.source.toUpperCase()} · Marginalia` },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Source not found</h1>
      <Link to="/code" className="mt-4 inline-block underline">Back to all sources</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this source</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

type DocLite = {
  id: string;
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
};

function SourceBrowser() {
  const { documents, source } = Route.useLoaderData();
  const sourceName = SOURCE_NAMES[source] ?? source.toUpperCase();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const map = new Map<string, DocLite[]>();
    for (const d of documents as DocLite[]) {
      if (f) {
        const hay = `${d.heading ?? ""} ${d.section_label ?? ""} ${d.identifier}`.toLowerCase();
        if (!hay.includes(f)) continue;
      }
      const k = d.parent_label ?? "Other";
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    return map;
  }, [documents, filter]);

  const visibleCount = Array.from(groups.values()).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">All sources</Link> · {documents.length} documents
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="ink-underline italic">{sourceName}</span>
        </h1>

        <div className="sticky top-0 z-20 -mx-6 mt-8 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${documents.length.toLocaleString()} entries — by heading, section, or citation…`}
              className="h-11 w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-10 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {filter && (
            <div className="mt-2 text-xs text-muted-foreground">
              {visibleCount.toLocaleString()} match{visibleCount === 1 ? "" : "es"} in {groups.size} group{groups.size === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          {groups.size === 0 && (
            <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
              No entries match "{filter}".
            </div>
          )}
          {Array.from(groups.entries()).map(([group, items]) => {
            const isCollapsed = collapsed[group] ?? false;
            return (
              <div key={group} className="overflow-hidden rounded-2xl border bg-card">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [group]: !isCollapsed }))}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="citation-tag text-accent">{group}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "entry" : "entries"}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-border/60 border-t border-border/60">
                    {items.map((d) => (
                      <li key={d.id}>
                        <Link
                          to="/code/$"
                          params={{ _splat: d.identifier.replace(/^\//, "") }}
                          className="flex items-baseline gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                        >
                          <span className="citation-tag w-28 shrink-0 text-muted-foreground">
                            {d.section_label ?? ""}
                          </span>
                          <span className="font-display text-sm font-semibold">{d.heading}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
