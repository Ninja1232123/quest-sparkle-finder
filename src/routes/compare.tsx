import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { searchDocuments } from "@/server/documents.functions";
import { GitCompare, Sparkles, Highlighter, Brain, FileDiff } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
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

function ComparePage() {
  const { q, sources } = Route.useSearch();
  const { columns, error } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="citation-tag text-muted-foreground flex items-center gap-1.5">
          <GitCompare className="h-3.5 w-3.5" /> side-by-side compare
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {q ? <>Compare <span className="ink-underline italic">"{q}"</span></> : "Pick a term. See it everywhere."}
        </h1>

        <form
          method="get"
          action="/compare"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. due process, warrant, oath"
            className="flex-1 rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm focus:border-foreground/40 focus:outline-none"
          />
          <input type="hidden" name="sources" value={sources} />
          <button type="submit" className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Compare
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["const", "usc", "cfr", "ucc", "tfm", "irm"] as const).map((c) => {
            const parts = sources.split(",").map((s: string) => s.trim());
            const active = parts.includes(c);
            const next = active
              ? parts.filter((s: string) => s !== c)
              : [...parts.filter(Boolean), c];
            const nextSources = next.slice(0, 4).join(",") || "usc";
            return (
              <Link
                key={c}
                to="/compare"
                search={{ q, sources: nextSources }}
                className={`rounded-full border px-3 py-1 ${
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

        {q && (
          <div className={`mt-8 grid gap-4 ${columns.length >= 4 ? "lg:grid-cols-4" : columns.length === 3 ? "lg:grid-cols-3" : columns.length === 2 ? "md:grid-cols-2" : ""}`}>
            {columns.map(({ code, hits }: { code: string; hits: Hit[] }) => (
              <div key={code} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="font-display text-sm font-semibold">{SOURCE_LABELS[code] ?? code}</div>
                  <div className="text-xs text-muted-foreground">{hits.length}</div>
                </div>
                {hits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">no matches</div>
                ) : (
                  <ul className="space-y-3">
                    {hits.map((h: Hit) => (
                      <li key={h.identifier}>
                        <Link
                          to="/code/$"
                          params={{ _splat: h.identifier.replace(/^\//, "") }}
                          search={{ q: q || undefined }}
                          className="block rounded-lg p-2 hover:bg-muted/50"
                        >
                          <div className="font-mono text-[10px] text-muted-foreground/70">{h.identifier}</div>
                          <div className="font-display text-sm font-medium leading-tight text-foreground">
                            {h.heading || h.section_label || h.identifier}
                          </div>
                          {h.snippet && (
                            <div className="mt-1 text-xs text-foreground/65 line-clamp-2">{h.snippet}</div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Vision: where compare goes next */}
        <div className="mt-20">
          <ComingSoonHeader
            eyebrow="compare, leveled up"
            title="Where this gets really useful."
            subtitle="Right now you get the same term in every column. Here's what we're building on top."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ComingSoonCard
              icon={FileDiff}
              status="building"
              title="True diff mode"
              pitch="Pin two sections — current vs. prior version, federal vs. state, statute vs. regulation — and see the changes word-for-word, with the substantive shifts highlighted."
            />
            <ComingSoonCard
              icon={Brain}
              status="soon"
              title="Plain-English summary of differences"
              pitch="One paragraph, generated from the actual text, that tells you what's actually different between the columns — and links every claim back to the source."
            />
            <ComingSoonCard
              icon={Highlighter}
              status="soon"
              title="Match-aligned columns"
              pitch="Subsections that say the same thing line up across columns. Gaps mean one codebook covers something the others don't — and we'll tell you which."
            />
            <ComingSoonCard
              icon={Sparkles}
              status="vision"
              title="Authority-rank"
              pitch="When two sources conflict, see which one wins under preemption, supremacy, or the agency's own deference rules — with the doctrine cited."
            />
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
