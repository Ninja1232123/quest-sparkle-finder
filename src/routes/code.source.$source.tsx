import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  listDocumentsBySource,
  listSources,
  getSourceTOC,
  getRegisterYears,
  getRegisterDays,
  getBillCongresses,
  getBillList,
  listDocsBySortRange,
  FIREHOSE_SOURCES,
  type SourceTocNode,
  type SourceSummary,
  type RegisterYear,
  type RegisterDay,
  type BillCongress,
  type BillRow,
} from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Search as SearchIcon, X, BookOpen, Network } from "lucide-react";
import { sourceMeta, sourceName } from "@/lib/source-groups";

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  const: "Browse the United States Constitution article by article — every clause, amendment, and ratification, indexed and cross-referenced on Marginalia.",
  usc: "Browse the United States Code on Marginalia — every title and section of federal statutory law, searchable and cross-linked to the regulations that implement it.",
  cfr: "Browse the Code of Federal Regulations on Marginalia — every title and part of the rules federal agencies enforce, threaded to the statutes that authorize them.",
  ucc: "Browse the Uniform Commercial Code on Marginalia — the model commercial-law statute behind contracts, sales, leases, and secured transactions across U.S. states.",
  tfm: "Browse the Treasury Financial Manual on Marginalia — the federal government's accounting and disbursing rulebook for agencies that handle public money.",
  irm: "Browse the Internal Revenue Manual on Marginalia — the IRS's internal procedures for examinations, collections, appeals, and taxpayer rights.",
};

// Coerce a search param to a non-empty string (accepts numbers — the parser may
// hand back a number for digit-y values like a congress without leading zeros).
const str = (v: unknown) => {
  if (typeof v === "string") return v.length > 0 ? v : undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
};
// Numeric search param. Kept as a NUMBER so the URL round-trips clean
// (`?ry=2000`, not the quoted `?ry="2000"` TanStack emits for numeric strings).
const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
};

// All keys optional so Links may pass any subset (or none) without TS demanding
// the full shape. `group` = TOC drill; ry/rd = register; bc/bk/bq/bp = bill.
// ry/rd/bp are numbers (clean URLs); the loader stringifies ry/rd as needed.
type SourceSearch = {
  group?: string;
  ry?: number;
  rd?: number;
  bc?: string;
  bk?: string;
  bq?: string;
  bp?: number;
};

// Leaf sort_key range for a firehose drill-down, half-open [lo, hi).
// sort_key uses the DB's *locale* collation, where punctuation does NOT compare
// as ASCII — so the bounds must differ from the data only in DIGITS, never in a
// punctuation char. Hence "next day" / "next bill number" rather than appending
// a separator like ':' or '/'.
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
// 'YYYYMMDD' -> the next calendar day as 'YYYYMMDD' (handles month/year rollover).
function nextDay8(d: string): string {
  const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1));
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}
// 'CONG.TT.NNNNNN' -> 'CONG.TT.<NNNNNN+1>' (same width), an exclusive upper bound
// for one bill's sections that differs only in the number field's digits.
function nextBillKey(bk: string): string {
  const parts = bk.split(".");
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = String(Number(last) + 1).padStart(last.length, "0");
  return parts.join(".");
}
function leafRange(source: string, key: string): { lo: string; hi: string } {
  if (source === "register") return { lo: key, hi: nextDay8(key) };
  return { lo: key + ".00000", hi: nextBillKey(key) };
}

async function loadFirehose(source: string, deps: SourceSearch) {
  if (source === "register") {
    // ry/rd arrive as numbers; stringify for the date keys. Validate the shape
    // here so a malformed param falls back to a valid view instead of throwing
    // (the server fns' zod validators would 500 on bad input otherwise).
    const rd = deps.rd != null ? String(deps.rd) : undefined;
    const ry = deps.ry != null ? String(deps.ry) : undefined;
    if (rd && /^\d{8}$/.test(rd)) {
      const { lo, hi } = leafRange(source, rd);
      const { documents } = await listDocsBySortRange({ data: { source, lo, hi, limit: 2000 } });
      return { view: "register-docs" as const, rd, documents };
    }
    if (ry && /^\d{4}$/.test(ry)) {
      const { days } = await getRegisterDays({ data: { year: ry } });
      return { view: "register-days" as const, ry, days };
    }
    const { years } = await getRegisterYears();
    return { view: "register-years" as const, years };
  }
  // bill
  if (deps.bk && /^\d+\.\d+\.\d+$/.test(deps.bk)) {
    const { lo, hi } = leafRange(source, deps.bk);
    const { documents } = await listDocsBySortRange({ data: { source, lo, hi, limit: 2000 } });
    return { view: "bill-docs" as const, bk: deps.bk, documents };
  }
  if (deps.bc && /^\d{1,4}$/.test(deps.bc)) {
    const limit = 60;
    const page = deps.bp ?? 0;
    const { bills, hasMore } = await getBillList({
      data: { congress: deps.bc, q: deps.bq, limit, offset: page * limit },
    });
    return { view: "bill-list" as const, bc: deps.bc, bq: deps.bq, bp: page, bills, hasMore };
  }
  const { congresses } = await getBillCongresses();
  return { view: "bill-congresses" as const, congresses };
}

export const Route = createFileRoute("/code/source/$source")({
  validateSearch: (search: Record<string, unknown>): SourceSearch => ({
    group: str(search.group),
    ry: num(search.ry),
    rd: num(search.rd),
    bc: str(search.bc),
    bk: str(search.bk),
    bq: str(search.bq),
    bp: num(search.bp),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const source = params.source;
    const sourcesPromise = listSources();

    // Firehoses (bill, register): date / Congress drill-down, never the flat TOC.
    if (FIREHOSE_SOURCES.has(source)) {
      const fh = await loadFirehose(source, deps);
      const { sources } = await sourcesPromise;
      return { kind: "firehose" as const, source, sources, ...fh };
    }

    // Everything else: the parent_label table of contents. Load a single group's
    // sections only when a group is selected.
    const tocPromise = getSourceTOC({ data: { source } });
    const docsPromise = deps.group
      ? listDocumentsBySource({ data: { source, parent_label: deps.group, limit: 5000 } })
      : Promise.resolve({ documents: [], error: null as string | null });
    const [tocRes, sourcesRes, docsRes] = await Promise.all([tocPromise, sourcesPromise, docsPromise]);
    if (tocRes.error) throw new Error(tocRes.error);
    if (tocRes.toc.length === 0) throw notFound();
    return {
      kind: "toc" as const,
      toc: tocRes.toc,
      documents: docsRes.documents,
      sources: sourcesRes.sources,
      source,
      group: deps.group,
    };
  },
  component: SourceRouteView,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: ({ params }) => {
    const name = sourceName(params.source);
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

type LoaderData = ReturnType<typeof Route.useLoaderData>;
type TocData = Extract<LoaderData, { kind: "toc" }>;
type FirehoseLoaderData = Extract<LoaderData, { kind: "firehose" }>;

function SourceRouteView() {
  const data = Route.useLoaderData();
  if (data.kind === "firehose") return <FirehoseBrowser data={data} />;
  return <SourceBrowser data={data} />;
}

function SourceBrowser({ data }: { data: TocData }) {
  const { toc, documents, sources, source, group } = data;
  const tocTyped = toc as SourceTocNode[];
  const displayName = sourceName(source);
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
          <span className="ink-underline italic">{displayName}</span>
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

// ---------------------------------------------------------------------------
// Firehose browser — bill & register. A 3-level drill-down driven by search
// params (no flat TOC): year/Congress -> day/bill -> sections.
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  if (!m || !d) return yyyymmdd;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function ordinal(nStr: string): string {
  const n = parseInt(nStr, 10);
  if (!n) return nStr;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// One row in a leaf (a day's notices, or a bill's sections).
function DocRow({ d }: { d: DocLite }) {
  return (
    <li>
      <Link
        to="/code/$"
        params={{ _splat: d.identifier.replace(/^\//, "") }}
        className="flex items-baseline gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="citation-tag w-32 shrink-0 truncate text-muted-foreground">
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
  );
}

// A grid of clickable buckets (years, Congresses, days).
function BucketGrid({
  items,
  source,
  searchFor,
}: {
  items: { key: string; label: string; sub?: string; count: number }[];
  source: string;
  searchFor: (key: string) => SourceSearch;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <Link
          key={it.key}
          to="/code/source/$source"
          params={{ source }}
          search={searchFor(it.key)}
          className="group rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
        >
          <div className="font-display text-lg font-semibold">{it.label}</div>
          {it.sub && <div className="text-xs text-muted-foreground">{it.sub}</div>}
          <div className="mt-2 citation-tag text-muted-foreground">
            {it.count.toLocaleString()} {it.count === 1 ? "doc" : "docs"}
          </div>
        </Link>
      ))}
    </div>
  );
}

function FirehoseBrowser({ data }: { data: FirehoseLoaderData }) {
  const { source, sources } = data;
  const navigate = useNavigate();
  const meta = sourceMeta(source);
  const displayName = sourceName(source);
  const total = sources.find((s: SourceSummary) => s.code === source)?.count ?? 0;

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">this source</div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.accent }} />
            <span className="font-display text-sm font-semibold">{meta.short}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{meta.group}</span>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">documents</div>
          <div className="font-display text-2xl font-semibold">{total.toLocaleString()}</div>
          {meta.tagline && <p className="mt-2 text-xs leading-relaxed text-foreground/65">{meta.tagline}</p>}
        </div>
      </div>
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">how to browse</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card/30 p-3 text-xs leading-relaxed text-foreground/65">
          {source === "register"
            ? "Pick a year, then an issue date, to read that day's rules, proposed rules, and notices."
            : "Pick a Congress, then a bill — or type a bill number or keywords to filter."}
        </div>
      </div>
    </div>
  );

  // Breadcrumb trail. Each level links back up.
  const crumbs = (
    <div className="citation-tag text-muted-foreground">
      <Link to="/code" className="hover:text-foreground">All sources</Link>
      {" · "}
      <Link to="/code/source/$source" params={{ source }} className="hover:text-foreground">{displayName}</Link>
      {data.view === "register-days" && <>{" · "}<span className="text-foreground/80">{data.ry}</span></>}
      {data.view === "register-docs" && (
        <>
          {" · "}
          <Link to="/code/source/$source" params={{ source }} search={{ ry: Number(data.rd.slice(0, 4)) }} className="hover:text-foreground">
            {data.rd.slice(0, 4)}
          </Link>
          {" · "}
          <span className="text-foreground/80">{fmtDay(data.rd)}</span>
        </>
      )}
      {data.view === "bill-list" && <>{" · "}<span className="text-foreground/80">{ordinal(data.bc)} Congress</span></>}
      {data.view === "bill-docs" && (
        <>
          {" · "}
          <Link to="/code/source/$source" params={{ source }} search={{ bc: data.bk.split(".")[0] }} className="hover:text-foreground">
            {ordinal(data.bk.split(".")[0])} Congress
          </Link>
          {" · "}
          <span className="text-foreground/80">this bill</span>
        </>
      )}
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-4xl">
      <section>
        {crumbs}
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="ink-underline italic">{displayName}</span>
        </h1>

        {data.view === "register-years" && (
          <BucketGrid
            source={source}
            items={data.years.map((y: RegisterYear) => ({ key: y.year, label: y.year, count: y.count }))}
            searchFor={(year) => ({ ry: Number(year) })}
          />
        )}
        {data.view === "register-days" && (
          <>
            <p className="mt-3 text-sm text-foreground/70">{data.days.length} issue {data.days.length === 1 ? "day" : "days"} in {data.ry}.</p>
            <BucketGrid
              source={source}
              items={data.days.map((d: RegisterDay) => ({ key: d.date, label: fmtDay(d.date), count: d.count }))}
              searchFor={(day) => ({ ry: Number(data.ry), rd: Number(day) })}
            />
          </>
        )}

        {data.view === "bill-congresses" && (
          <BucketGrid
            source={source}
            items={data.congresses.map((c: BillCongress) => ({ key: c.congress, label: `${ordinal(c.congress)} Congress`, count: c.count }))}
            searchFor={(congress) => ({ bc: congress })}
          />
        )}
        {data.view === "bill-list" && (
          <BillList
            source={source}
            congress={data.bc}
            q={data.bq}
            page={data.bp}
            bills={data.bills}
            hasMore={data.hasMore}
            onSearch={(q) => navigate({ to: "/code/source/$source", params: { source }, search: { bc: data.bc, bq: q || undefined } })}
            onPage={(p) => navigate({ to: "/code/source/$source", params: { source }, search: { bc: data.bc, bq: data.bq, bp: p || undefined } })}
          />
        )}

        {(data.view === "register-docs" || data.view === "bill-docs") && (
          <LeafDocs source={source} docs={data.documents as DocLite[]} />
        )}
      </section>
    </ResearchShell>
  );
}

function LeafDocs({ source, docs }: { source: string; docs: DocLite[] }) {
  // Title the leaf from the first doc's parent_label (date · agency, or the bill line).
  const head = docs[0]?.parent_label ?? "";
  const title = source === "register"
    ? head.split(" · ").slice(1).join(" · ") || head
    : head.split(" — ")[0].split(" · ").slice(1).join(" · ") || head;
  return (
    <div className="mt-8">
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b border-border/60 px-5 py-3">
            {title && <div className="font-display text-sm font-semibold">{title}</div>}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {docs.length.toLocaleString()} {docs.length === 1 ? "section" : "sections"}
            </div>
          </div>
          <ul className="divide-y divide-border/60">
            {docs.map((d) => <DocRow key={d.id} d={d} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function BillList({
  source,
  congress,
  q,
  page,
  bills,
  hasMore,
  onSearch,
  onPage,
}: {
  source: string;
  congress: string;
  q?: string;
  page: number;
  bills: BillRow[];
  hasMore: boolean;
  onSearch: (q: string) => void;
  onPage: (p: number) => void;
}) {
  const [text, setText] = useState(q ?? "");
  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(text.trim()); }}
        className="sticky top-[68px] z-20 -mx-6 mb-4 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter bills — by number (e.g. H.R. 1) or words in the title…"
            className="h-11 w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-10 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          />
          {text && (
            <button
              type="button"
              onClick={() => { setText(""); onSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          {q ? `No bills in the ${ordinal(congress)} Congress match "${q}".` : "No bills found."}
        </div>
      ) : (
        <ul className="space-y-2">
          {bills.map((b) => {
            const billLine = b.label.split(" · ").slice(1).join(" · ") || b.label;
            return (
              <li key={b.bill_key}>
                <Link
                  to="/code/source/$source"
                  params={{ source }}
                  search={{ bc: congress, bk: b.bill_key }}
                  className="flex items-baseline gap-4 rounded-2xl border bg-card px-5 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="citation-tag w-44 shrink-0 truncate text-muted-foreground">{billLine}</span>
                  <span className="min-w-0 flex-1 font-display text-sm">{b.title ?? "—"}</span>
                  <span className="citation-tag shrink-0 text-muted-foreground">{b.n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 0 || hasMore) && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPage(page - 1)}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-4 py-2 text-sm disabled:opacity-40 enabled:hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="citation-tag text-muted-foreground">page {page + 1}</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => onPage(page + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-4 py-2 text-sm disabled:opacity-40 enabled:hover:bg-muted"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
