import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { searchDocuments, getSectionPreview } from "@/lib/documents.functions";
import {
  GitCompare,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  X,
  ExternalLink,
  Layers,
  Trash2,
  Loader2,
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};
const SOURCE_SHORT: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

const compareSchema = z.object({
  q: fallback(z.string(), "").default(""),
  sources: fallback(z.string(), "usc,cfr").default("usc,cfr"),
});

type Hit = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string;
};

export const Route = createFileRoute("/compare")({
  validateSearch: zodValidator(compareSchema),
  loaderDeps: ({ search }) => ({ q: search.q, sources: search.sources }),
  loader: async ({ deps }) => {
    const codes = deps.sources.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (!deps.q || deps.q.trim().length < 2) {
      return { columns: codes.map((c) => ({ code: c, hits: [] as Hit[] })), error: null as string | null };
    }
    const results = await Promise.all(
      codes.map((code) =>
        searchDocuments({ data: { q: deps.q.trim(), source: code } }).then((r) => ({
          code,
          hits: (r.hits ?? []).slice(0, 12) as Hit[],
          error: r.error,
        })),
      ),
    );
    const error = results.map((r) => r.error).find(Boolean) ?? null;
    return { columns: results.map(({ code, hits }) => ({ code, hits })), error };
  },
  component: ComparePage,
  head: ({ match }) => {
    const q = (match.search as { q?: string })?.q ?? "";
    const title = q ? `Compare "${q}" · Marginalia` : "Compare codebooks · Marginalia";
    const description = q
      ? `Side-by-side comparison of "${q}" across the Constitution, U.S. Code, CFR, UCC, TFM, and IRM.`
      : "Side-by-side search across the Constitution, U.S. Code, CFR, UCC, TFM, and IRM. Spot how the same term shows up in each codebook.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://self-law.org/compare" },
      ],
      links: [{ rel: "canonical", href: "https://self-law.org/compare" }],
    };
  },
});

// ---------------------------------------------------------------------------
// Highlight rendering
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

// The server snippet is a small HTML string with <mark> (or <b>) around matches
// and &-escaped entities elsewhere. Parse it into React nodes so highlights
// render instead of showing literal "<mark>" tags — and without ever feeding raw
// HTML to dangerouslySetInnerHTML.
function renderMarked(snippet: string): ReactNode[] {
  const parts = snippet.split(/(<\/?mark>|<\/?b>)/i);
  const out: ReactNode[] = [];
  let inMark = false;
  let key = 0;
  for (const p of parts) {
    if (/^<\/?(mark|b)>$/i.test(p)) {
      inMark = /^<(mark|b)>$/i.test(p);
      continue;
    }
    if (!p) continue;
    const text = decodeEntities(p);
    out.push(
      inMark ? (
        <mark key={key++} className="rounded-[2px] bg-terracotta/15 px-0.5 text-foreground">
          {text}
        </mark>
      ) : (
        <span key={key++}>{text}</span>
      ),
    );
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Highlight the live query terms inside plain expanded text (no server marks).
function highlightQuery(text: string, q: string): ReactNode[] {
  const terms = q
    .replace(/["()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map(escapeRe);
  if (terms.length === 0) return [text];
  const re = new RegExp(`(${terms.join("|")})`, "ig");
  return text.split(re).map((p, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-[2px] bg-terracotta/15 px-0.5 text-foreground">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

// ---------------------------------------------------------------------------
// Shelf — pinned citations, persisted across searches
// ---------------------------------------------------------------------------

type ShelfItem = {
  identifier: string;
  source_code: string;
  section_label: string | null;
  heading: string | null;
  snippet: string;
};

const SHELF_KEY = "marginalia.compare.shelf.v1";

function useShelf() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHELF_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SHELF_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const has = (id: string) => items.some((i) => i.identifier === id);
  const toggle = (it: ShelfItem) =>
    setItems((prev) =>
      prev.some((x) => x.identifier === it.identifier)
        ? prev.filter((x) => x.identifier !== it.identifier)
        : [...prev, it],
    );
  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.identifier !== id));
  const clear = () => setItems([]);
  return { items, hydrated, has, toggle, remove, clear };
}

type Shelf = ReturnType<typeof useShelf>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ComparePage() {
  const { q, sources } = Route.useSearch();
  const { columns, error } = Route.useLoaderData();
  const shelf = useShelf();
  // Up to two shelf items selected for a side-by-side diff (keep the last two).
  const [diffPick, setDiffPick] = useState<string[]>([]);
  const togglePick = (id: string) =>
    setDiffPick((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id],
    );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-[88rem] px-6 py-12">
        <div className="citation-tag text-muted-foreground flex items-center gap-1.5">
          <GitCompare className="h-3.5 w-3.5" /> side-by-side compare
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {q ? (
            <>
              Compare <span className="ink-underline italic">"{q}"</span>
            </>
          ) : (
            "Pick a term. See it everywhere."
          )}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-foreground/65">
          Search a term across every codebook at once. Expand any result inline, and pin the ones
          worth keeping to your shelf — they stay put while you keep searching.
        </p>

        <form method="get" action="/compare" className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. due process, warrant, oath"
            className="flex-1 rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm focus:border-foreground/40 focus:outline-none"
          />
          <input type="hidden" name="sources" value={sources} />
          <button
            type="submit"
            className="rounded-lg bg-terracotta px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90"
          >
            Compare
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["const", "usc", "cfr", "ucc", "tfm", "irm"] as const).map((c) => {
            const parts = sources.split(",").map((s: string) => s.trim());
            const active = parts.includes(c);
            const next = active ? parts.filter((s: string) => s !== c) : [...parts.filter(Boolean), c];
            const nextSources = next.slice(0, 4).join(",") || "usc";
            return (
              <Link
                key={c}
                to="/compare"
                search={{ q, sources: nextSources }}
                className={`rounded-full border px-3 py-1 transition ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {SOURCE_LABELS[c] ?? c}
              </Link>
            );
          })}
          <span className="text-muted-foreground/60 self-center">· up to 4 columns</span>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results + shelf */}
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <main className="min-w-0 flex-1">
            {q ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {columns.map(({ code, hits }: { code: string; hits: Hit[] }) => (
                  <Column key={code} code={code} hits={hits} q={q} shelf={shelf} />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </main>

          <aside className="lg:sticky lg:top-20 lg:w-80 lg:shrink-0 lg:self-start">
            <ShelfPanel shelf={shelf} q={q} diffPick={diffPick} onTogglePick={togglePick} />
          </aside>
        </div>

        <FutureNote />
      </section>
      <SiteFooter />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
      <GitCompare className="mx-auto h-8 w-8 text-foreground/25" />
      <p className="mt-3 font-display text-lg">Start with a term.</p>
      <p className="mt-1 text-sm text-foreground/55">
        Try “due process”, “good faith”, or “statute of limitations”.
      </p>
    </div>
  );
}

function Column({
  code,
  hits,
  q,
  shelf,
}: {
  code: string;
  hits: Hit[];
  q: string;
  shelf: Shelf;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-border/60 bg-card lg:w-auto lg:min-w-[16rem] lg:flex-1">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="font-display text-sm font-semibold leading-tight">{SOURCE_LABELS[code] ?? code}</div>
        <div className="citation-tag shrink-0 text-muted-foreground">{hits.length}</div>
      </div>
      {hits.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">no matches</div>
      ) : (
        <ul className="divide-y divide-border/40">
          {hits.map((h) => (
            <HitCard key={h.identifier} hit={h} q={q} shelf={shelf} />
          ))}
        </ul>
      )}
    </div>
  );
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; text: string; truncated: boolean }
  | { status: "error" };

function HitCard({ hit, q, shelf }: { hit: Hit; q: string; shelf: Shelf }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const pinned = shelf.has(hit.identifier);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !preview) {
      setPreview({ status: "loading" });
      try {
        const res = await getSectionPreview({ data: { identifier: hit.identifier } });
        const p = res.preview;
        setPreview(p ? { status: "ready", text: p.text, truncated: p.truncated } : { status: "error" });
      } catch {
        setPreview({ status: "error" });
      }
    }
  }

  return (
    <li className={`relative ${pinned ? "bg-accent/[0.04]" : ""}`}>
      {pinned && <span className="absolute inset-y-0 left-0 w-[3px] bg-terracotta" aria-hidden />}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-muted-foreground/70">{hit.identifier}</div>
            <Link
              to="/code/$"
              params={{ _splat: hit.identifier.replace(/^\//, "") }}
              search={{ q: q || undefined }}
              className="mt-0.5 block font-display text-sm font-medium leading-tight text-foreground hover:text-terracotta"
            >
              {hit.heading || hit.section_label || hit.identifier}
            </Link>
          </div>
          <button
            type="button"
            onClick={() =>
              shelf.toggle({
                identifier: hit.identifier,
                source_code: hit.source_code,
                section_label: hit.section_label,
                heading: hit.heading,
                snippet: hit.snippet,
              })
            }
            aria-label={pinned ? "Remove from shelf" : "Pin to shelf"}
            title={pinned ? "Remove from shelf" : "Pin to shelf"}
            className={`shrink-0 rounded-md p-1.5 transition ${
              pinned
                ? "text-terracotta"
                : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
            }`}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        {hit.snippet && (
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/65">{renderMarked(hit.snippet)}</p>
        )}

        {open && (
          <div className="mt-2 rounded-lg border border-border/50 bg-background/60 p-3 text-xs leading-relaxed text-foreground/75">
            {!preview || preview.status === "loading" ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> loading…
              </span>
            ) : preview.status === "error" ? (
              <span className="text-muted-foreground">Couldn’t load the text.</span>
            ) : (
              <>
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap">
                  {highlightQuery(preview.text, q)}
                </div>
                {preview.truncated && (
                  <Link
                    to="/code/$"
                    params={{ _splat: hit.identifier.replace(/^\//, "") }}
                    search={{ q: q || undefined }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:underline"
                  >
                    Open full section <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={toggleOpen}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          {open ? "Show less" : "Show more"}
        </button>
      </div>
    </li>
  );
}

function ShelfPanel({
  shelf,
  q,
  diffPick,
  onTogglePick,
}: {
  shelf: Shelf;
  q: string;
  diffPick: string[];
  onTogglePick: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const count = shelf.items.length;
  // Only diff picks that are still on the shelf, in pick order.
  const validPick = diffPick.filter((id) => shelf.items.some((i) => i.identifier === id));

  return (
    <div className="rounded-2xl border border-border/60 bg-card paper-grain">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 font-display text-sm font-semibold"
        >
          <Layers className="h-4 w-4 text-terracotta" />
          Shelf
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {count}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={shelf.clear}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> clear
          </button>
        )}
      </div>

      {!collapsed &&
        (count === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bookmark className="mx-auto h-5 w-5 text-foreground/25" />
            <p className="mt-2 text-xs text-foreground/55">
              Pin results here to set them aside and keep searching — they stay until you remove
              them.
            </p>
          </div>
        ) : (
          <>
            {count >= 2 && (
              <div className="border-b border-border/60 px-4 py-3">
                {validPick.length === 2 ? (
                  <Link
                    to="/compare/diff"
                    search={{ a: validPick[0], b: validPick[1] }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-xs font-semibold text-paper hover:opacity-90"
                  >
                    <GitCompare className="h-3.5 w-3.5" /> Compare these two →
                  </Link>
                ) : (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {validPick.length === 1
                      ? "Pick one more with the ⇄ toggle to diff."
                      : "Select two with the ⇄ toggle for a word-for-word diff."}
                  </p>
                )}
              </div>
            )}
            <ul className="divide-y divide-border/40">
              {shelf.items.map((it) => {
                const slot = validPick.indexOf(it.identifier);
                return (
                  <li key={it.identifier} className="group px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="citation-tag text-muted-foreground">
                          {SOURCE_SHORT[it.source_code ?? ""] ?? (it.source_code ?? "").toUpperCase()}
                        </span>
                        <Link
                          to="/code/$"
                          params={{ _splat: it.identifier.replace(/^\//, "") }}
                          search={{ q: q || undefined }}
                          className="mt-0.5 block font-display text-sm font-medium leading-tight hover:text-terracotta"
                        >
                          {it.heading || it.section_label || it.identifier}
                        </Link>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onTogglePick(it.identifier)}
                          aria-label={slot >= 0 ? "Unselect from diff" : "Select for diff"}
                          title="Select for diff"
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition ${
                            slot >= 0
                              ? "border-terracotta bg-terracotta text-paper"
                              : "border-border/70 text-muted-foreground/60 hover:border-foreground/40 hover:text-foreground"
                          }`}
                        >
                          {slot >= 0 ? slot + 1 : "⇄"}
                        </button>
                        <button
                          type="button"
                          onClick={() => shelf.remove(it.identifier)}
                          aria-label="Remove from shelf"
                          className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {it.snippet && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
                        {renderMarked(it.snippet)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ))}
    </div>
  );
}

function FutureNote() {
  return (
    <p className="mt-12 border-t border-border/50 pt-5 text-xs text-muted-foreground">
      New: pin two sections to the shelf, select them, and get a{" "}
      <span className="font-medium text-foreground/70">word-for-word diff</span>. Coming next — a
      plain-English summary of what actually differs, every claim linked back to the source.
    </p>
  );
}
