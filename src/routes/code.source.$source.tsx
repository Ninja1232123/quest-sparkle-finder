import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listDocumentsBySource, listSources, getSourceTOC, type SourceTocNode } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search as SearchIcon, X, BookOpen, Network } from "lucide-react";
import { sourceMeta } from "@/lib/source-groups";

const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  const: "Browse the United States Constitution article by article — every clause, amendment, and ratification, indexed and cross-referenced on Marginalia.",
  usc: "Browse the United States Code on Marginalia — every title and section of federal statutory law, searchable and cross-linked to the regulations that implement it.",
  cfr: "Browse the Code of Federal Regulations on Marginalia — every title and part of the rules federal agencies enforce, threaded to the statutes that authorize them.",
  ucc: "Browse the Uniform Commercial Code on Marginalia — the model commercial-law statute behind contracts, sales, leases, and secured transactions across U.S. states.",
  tfm: "Browse the Treasury Financial Manual on Marginalia — the federal government's accounting and disbursing rulebook for agencies that handle public money.",
  irm: "Browse the Internal Revenue Manual on Marginalia — the IRS's internal procedures for examinations, collections, appeals, and taxpayer rights.",
};

export const Route = createFileRoute("/code/source/$source")({
  validateSearch: (search: Record<string, unknown>) => ({
    group: typeof search.group === "string" ? search.group : undefined,
  }),
  loaderDeps: ({ search }) => ({ group: search.group }),
  loader: async ({ params, deps }) => {
    // Always load the TOC and the corpus list (for the shell sidebar). Load
    // a single group's sections only if a group is selected.
    const tocPromise = getSourceTOC({ data: { source: params.source } });
    const sourcesPromise = listSources();
    const docsPromise = deps.group
      ? listDocumentsBySource({ data: { source: params.source, parent_label: deps.group, limit: 5000 } })
      : Promise.resolve({ documents: [], error: null as string | null });
    const [tocRes, sourcesRes, docsRes] = await Promise.all([tocPromise, sourcesPromise, docsPromise]);
    if (tocRes.error) throw new Error(tocRes.error);
    if (tocRes.toc.length === 0) throw notFound();
    return {
      toc: tocRes.toc,
      documents: docsRes.documents,
      sources: sourcesRes.sources,
      source: params.source,
      group: deps.group,
    };
  },
  component: SourceBrowser,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: ({ params }) => {
    const name = SOURCE_NAMES[params.source] ?? params.source.toUpperCase();
    const title = `${name} · Marginalia`;
    const description =
      SOURCE_DESCRIPTIONS[params.source] ??
      `Browse ${name} on Marginalia — a pro se reading desk indexing federal codebooks together with cross-references and plain-English context.`;
    const url = `https://self-law.org/code/source/${params.source}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
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

function SourceBrowserPending() {
  // No corpus list available pre-load; render a minimal stand-in shell-shape.
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">Loading…</div>
        <div className="mt-2 h-10 w-2/3 animate-pulse rounded-md bg-muted/60" />
        <div className="mt-8 h-11 w-full animate-pulse rounded-full bg-muted/40" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl border bg-card/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const { toc, documents, sources, source, group } = Route.useLoaderData();
  const tocTyped = toc as SourceTocNode[];
  const sourceName = SOURCE_NAMES[source] ?? source.toUpperCase();
  const meta = sourceMeta(source);
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

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">this source</div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.accent }}
            />
            <span className="font-display text-sm font-semibold">{meta.short}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {meta.group}
            </span>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">documents</div>
          <div className="font-display text-2xl font-semibold">{totalDocs.toLocaleString()}</div>
          {meta.tagline && (
            <p className="mt-2 text-xs leading-relaxed text-foreground/65">{meta.tagline}</p>
          )}
        </div>
      </div>

      {group ? (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">in {group}</div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-foreground/70">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">entries</div>
            <div className="mt-0.5 font-display text-lg font-semibold text-foreground">
              {(documents as DocLite[]).length.toLocaleString()}
            </div>
            <Link
              to="/code/source/$source"
              params={{ source }}
              className="mt-2 inline-block text-[11px] text-accent hover:underline"
            >
              ← back to table of contents
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="citation-tag mb-1.5 text-muted-foreground">structure</div>
          <ul className="space-y-1 text-xs text-foreground/65">
            <li className="flex items-center justify-between">
              <span>titles / parts</span>
              <span className="font-mono">{tocTyped.length.toLocaleString()}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>sections</span>
              <span className="font-mono">{totalDocs.toLocaleString()}</span>
            </li>
          </ul>
        </div>
      )}

      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">soon · here</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card/30 p-3 text-xs text-foreground/65">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Network className="h-3.5 w-3.5" />
            Citation graph
          </div>
          <p className="mt-1 leading-relaxed">
            Open a section and this rail will map every rule that cites it and every authority it depends on — across all codebooks.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-4xl">
      <section>
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

        <div className="sticky top-[68px] z-20 -mx-6 mt-8 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
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
    </ResearchShell>
  );
}
