import { createFileRoute, Link } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getFamilyList } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { FAMILY_META, fmt } from "@/components/outcomes/ui";
import { BarChart3, ChevronRight, Gavel, Scale } from "lucide-react";

export const Route = createFileRoute("/outcomes/")({
  loader: async () => {
    const [{ sources }, { families }] = await Promise.all([listSources(), getFamilyList()]);
    return { sources, families };
  },
  component: OutcomesHub,
  head: () => ({
    meta: [
      { title: "Court Outcomes — how federal cases actually end · Self-Law" },
      {
        name: "description",
        content:
          "Base rates from millions of closed federal civil cases: how often plaintiffs win, how often cases settle or are dismissed, and how it varies by court — by claim type. Descriptive statistics, not legal advice.",
      },
      { property: "og:title", content: "Court Outcomes · Self-Law" },
      { property: "og:description", content: "How federal cases actually end — base rates by claim type and court." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/outcomes" }],
  }),
});

function OutcomesHub() {
  const { sources, families } = Route.useLoaderData();
  const totalFiled = families.reduce((n: number, f: any) => n + (f.total_cases ?? 0), 0);

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-5xl">
      <header className="mb-8">
        <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
          <BarChart3 className="h-3.5 w-3.5" /> Court outcomes
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          How cases actually end
        </h1>
        <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
          The law tells you what your rights <em>are</em>. This tells you what usually <em>happens</em> — base rates
          drawn from <span className="text-foreground/80">{fmt(totalFiled)}</span> closed federal civil cases: how
          often plaintiffs win, how often cases settle or get dismissed, and how much it swings from one court to the
          next. Pick a claim type to start.
        </p>
        <p className="mt-2 max-w-2xl text-[13px] text-foreground/60">
          Descriptive statistics about the historical record — not a prediction about your case, and not legal advice.
        </p>
      </header>

      {/* State appeals — the other layer */}
      <Link
        to="/outcomes/states"
        className="group mb-8 flex items-center gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/5 px-5 py-4 transition-colors hover:bg-terracotta/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta">
          <Gavel className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-tight">State appeals — do they succeed?</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Reversal rates for state supreme &amp; appellate courts. How often the court below gets overturned — by state.
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <h2 className="mb-3 font-display text-lg font-semibold">Federal — civil cases by claim type</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {families.map((f: any) => {
          const slug = f.slug;
          const key = slug.split("/").pop() ?? "";
          const meta = FAMILY_META[key];
          return (
            <Link
              key={slug}
              to={slug as never}
              className="group flex items-start gap-4 rounded-2xl border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ochre/15 text-ochre">
                <Scale className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-display text-lg font-semibold leading-tight">
                    {meta?.name ?? f.family}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </div>
                {meta?.blurb && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{meta.blurb}</p>}
                <div className="mt-2 font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
                  {fmt(f.total_cases)} cases
                  {f.plaintiff_win_pct != null && (
                    <> · {f.plaintiff_win_pct}% plaintiff win (of merits judgments)</>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </ResearchShell>
  );
}
