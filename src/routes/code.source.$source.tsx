import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listDocumentsBySource, getSourceTOC, type SourceTocNode } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search as SearchIcon, X, BookOpen } from "lucide-react";

const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
};

export const Route = createFileRoute("/code/source/$source")({
  validateSearch: (search: Record<string, unknown>) => ({
    group: typeof search.group === "string" ? search.group : undefined,
  }),
  loaderDeps: ({ search }) => ({ group: search.group }),
  loader: async ({ params, deps }) => {
    // Always load the TOC; load a single group's sections only if requested.
    const tocPromise = getSourceTOC({ data: { source: params.source } });
    const docsPromise = deps.group
      ? listDocumentsBySource({ data: { source: params.source, parent_label: deps.group, limit: 5000 } })
      : Promise.resolve({ documents: [], error: null as string | null });
    const [tocRes, docsRes] = await Promise.all([tocPromise, docsPromise]);
    if (tocRes.error) throw new Error(tocRes.error);
    if (tocRes.toc.length === 0) throw notFound();
    return { toc: tocRes.toc, documents: docsRes.documents, source: params.source, group: deps.group };
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
  preview?: string | null;
};

// Some sources (notably UCC) have headings that are just the section
// number — useless on a list. Detect that and fall back to a body snippet.
function isWeakHeading(heading: string | null, section_label: string | null): boolean {
  if (!heading) return true;
  const h = heading.trim();
  if (h.length < 4) return true;
  if (/^[\d.\-§\s]+$/.test(h)) return true;
  if (section_label && h.replace(/\s+/g, "") === section_label.replace(/[§\s]/g, "")) return true;
  return false;
}

function SourceBrowser() {
  const { toc, documents, source, group } = Route.useLoaderData();
  const tocTyped = toc as SourceTocNode[];
  const sourceName = SOURCE_NAMES[source] ?? source.toUpperCase();
  const [filter, setFilter] = useState("");
  const [openTitles, setOpenTitles] = useState<Record<string, boolean>>(() => {
    if (!group) return {};
    // Auto-open the title containing the active group
    const activeTitle = tocTyped.find((t) => t.parts.some((p) => p.parent_label === group))?.title_group;
    return activeTitle ? { [activeTitle]: true } : {};
  });

  const filteredToc = useMemo<SourceTocNode[]>(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return tocTyped;
    return tocTyped
      .map((t) => ({
        ...t,
        parts: t.parts.filter(
          (p) => p.label.toLowerCase().includes(f) || t.title_group.toLowerCase().includes(f),
        ),
      }))
      .filter((t) => t.parts.length > 0);
  }, [tocTyped, filter]);

  const totalDocs = useMemo(() => tocTyped.reduce((n, t) => n + t.total, 0), [tocTyped]);
  const groupedSections = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!group) return [] as DocLite[];
    if (!f) return documents as DocLite[];
    return (documents as DocLite[]).filter((d) =>
      `${d.heading ?? ""} ${d.preview ?? ""} ${d.section_label ?? ""} ${d.identifier}`.toLowerCase().includes(f),
    );
  }, [documents, group, filter]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">All sources</Link> · {totalDocs.toLocaleString()} documents
          {group && (
            <>
              {" · "}
              <Link to="/code/source/$source" params={{ source }} className="hover:text-foreground">
                Table of contents
              </Link>
              {" · "}
              <span className="text-foreground/80">{group}</span>
            </>
          )}
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
              placeholder={
                group
                  ? `Filter ${(documents as DocLite[]).length.toLocaleString()} entries in ${group}…`
                  : `Filter ${toc.length} title${toc.length === 1 ? "" : "s"} — by name or number…`
              }
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
        </div>

        {!group && (
          <div className="mt-8 space-y-3">
            {filteredToc.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
                Nothing in the table of contents matches "{filter}".
              </div>
            )}
            {filteredToc.map((t) => {
              const open = openTitles[t.title_group] ?? false;
              return (
                <div key={t.title_group} className="overflow-hidden rounded-2xl border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpenTitles((c) => ({ ...c, [t.title_group]: !open }))}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <BookOpen className="h-4 w-4 shrink-0 text-accent/80" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-semibold">{t.title_group}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.parts.length} {t.parts.length === 1 ? "part" : "parts"} · {t.total.toLocaleString()} sections
                      </div>
                    </div>
                  </button>
                  {open && (
                    <ul className="grid grid-cols-1 gap-px border-t border-border/60 bg-border/60 sm:grid-cols-2">
                      {t.parts.map((p) => (
                        <li key={p.parent_label} className="bg-card">
                          <Link
                            to="/code/source/$source"
                            params={{ source }}
                            search={{ group: p.parent_label }}
                            className="flex items-baseline justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-muted/60"
                          >
                            <span className="font-display text-sm">{p.label}</span>
                            <span className="citation-tag text-muted-foreground">{p.count.toLocaleString()}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {group && (
          <div className="mt-8">
            {groupedSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
                {filter ? `No entries in ${group} match "${filter}".` : `No entries found.`}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card">
                <div className="border-b border-border/60 px-5 py-3">
                  <div className="citation-tag text-accent">{group}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {groupedSections.length.toLocaleString()} {groupedSections.length === 1 ? "entry" : "entries"}
                  </div>
                </div>
                <ul className="divide-y divide-border/60">
                  {groupedSections.map((d) => (
                    <li key={d.id}>
                      <Link
                        to="/code/$"
                        params={{ _splat: d.identifier.replace(/^\//, "") }}
                        className="flex items-baseline gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                      >
                        <span className="citation-tag w-28 shrink-0 text-muted-foreground">
                          {d.section_label ?? ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          {isWeakHeading(d.heading, d.section_label) ? (
                            <span className="line-clamp-2 text-sm text-foreground/80">
                              {d.preview || d.heading || "—"}
                              {d.preview && d.preview.length >= 140 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="font-display text-sm font-semibold">{d.heading}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
