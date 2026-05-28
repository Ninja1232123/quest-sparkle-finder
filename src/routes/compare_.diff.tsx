import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { getDiffPair, type DiffDocMeta } from "@/lib/documents.functions";
import { GitCompare, ArrowLeft, ExternalLink, Minus, Plus } from "lucide-react";

const SOURCE_SHORT: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

function labelOf(d: DiffDocMeta): string {
  return d.heading || d.section_label || d.identifier;
}

export const Route = createFileRoute("/compare_/diff")({
  validateSearch: (s: Record<string, unknown>) => ({
    a: typeof s.a === "string" ? s.a : "",
    b: typeof s.b === "string" ? s.b : "",
  }),
  loaderDeps: ({ search }) => ({ a: search.a, b: search.b }),
  loader: async ({ deps }) => {
    if (!deps.a || !deps.b) return { pair: null };
    return await getDiffPair({ data: { a: deps.a, b: deps.b } });
  },
  component: DiffPage,
  head: () => ({
    meta: [
      { title: "Section diff · Compare · Marginalia" },
      { name: "description", content: "Word-for-word diff between two sections of the law." },
    ],
  }),
});

function SectionTag({ d, sign, tone }: { d: DiffDocMeta; sign: string; tone: "del" | "add" }) {
  return (
    <Link
      to="/code/$"
      params={{ _splat: d.identifier.replace(/^\//, "") }}
      search={{ q: undefined }}
      className={`group flex items-start gap-2 rounded-xl border px-4 py-3 transition hover:border-foreground/40 ${
        tone === "del" ? "border-terracotta/30 bg-terracotta/[0.04]" : "border-sage/30 bg-sage/[0.05]"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          tone === "del" ? "bg-terracotta/15 text-terracotta" : "bg-sage/20 text-sage-deep"
        }`}
      >
        {sign}
      </span>
      <span className="min-w-0">
        <span className="citation-tag text-muted-foreground">
          {SOURCE_SHORT[d.source_code] ?? d.source_code.toUpperCase()} · {d.identifier}
        </span>
        <span className="mt-0.5 block font-display text-sm font-semibold leading-tight group-hover:text-terracotta">
          {labelOf(d)}
        </span>
      </span>
      <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
    </Link>
  );
}

function DiffPage() {
  const { pair } = Route.useLoaderData();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link
          to="/compare"
          search={{ q: "", sources: "usc,cfr" }}
          className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Compare
        </Link>

        <div className="citation-tag mt-6 flex items-center gap-1.5 text-muted-foreground">
          <GitCompare className="h-3.5 w-3.5" /> word-for-word diff
        </div>

        {!pair ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
            <p className="font-display text-lg">Pick two sections to diff.</p>
            <p className="mt-1 text-sm text-foreground/55">
              On the compare page, pin results to the shelf, then select two and choose “Compare these two”.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              What changed
            </h1>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SectionTag d={pair.a} sign="−" tone="del" />
              <SectionTag d={pair.b} sign="+" tone="add" />
            </div>

            {/* stats */}
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Minus className="h-3 w-3 text-terracotta" />
                <span className="font-semibold text-terracotta">{pair.stats.removed.toLocaleString()}</span> words only in the first
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3 w-3 text-sage-deep" />
                <span className="font-semibold text-sage-deep">{pair.stats.added.toLocaleString()}</span> words only in the second
              </span>
              <span>· {pair.stats.common.toLocaleString()} in common</span>
            </div>

            {/* unified word diff */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="border-b border-border/60 px-5 py-2.5">
                <span className="citation-tag text-muted-foreground">unified diff · first section vs. second</span>
              </div>
              <div className="whitespace-pre-wrap px-5 py-4 font-serif text-[15px] leading-[1.7] text-foreground/85">
                {pair.segments.map((s, i) =>
                  s.t === "eq" ? (
                    <span key={i}>{s.v}</span>
                  ) : s.t === "del" ? (
                    <del key={i} className="rounded-[2px] bg-terracotta/12 text-terracotta/90 no-underline [text-decoration:line-through]">
                      {s.v}
                    </del>
                  ) : (
                    <ins key={i} className="rounded-[2px] bg-sage/15 text-sage-deep no-underline">
                      {s.v}
                    </ins>
                  ),
                )}
              </div>
              {pair.truncated && (
                <div className="border-t border-border/60 px-5 py-2.5 text-xs text-muted-foreground">
                  Long sections — diff shown for the opening portion. Open either section for the full text.
                </div>
              )}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Coming next: a plain-English summary of what these differences mean — each claim linked to the source.
            </p>
          </>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
