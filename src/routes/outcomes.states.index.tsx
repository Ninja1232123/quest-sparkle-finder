import { createFileRoute, Link } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatesIndex } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Crumbs, fmt } from "@/components/outcomes/ui";
import { ChevronRight, Gavel } from "lucide-react";

type StateRow = { name: string; slug: string; supremeRev: number | null; courts: number; decided: number };

export const Route = createFileRoute("/outcomes/states/")({
  loader: async () => {
    const [{ sources }, { courts }] = await Promise.all([listSources(), getStatesIndex()]);
    return { sources, courts };
  },
  component: StatesIndex,
  head: () => ({
    meta: [
      { title: "State appeal outcomes — reversal rates by state · Self-Law" },
      {
        name: "description",
        content:
          "How often state supreme and appellate courts reverse the courts below them — reversal and remand base rates for all 50 states. Descriptive statistics, not legal advice.",
      },
      { property: "og:title", content: "State appeal outcomes · Self-Law" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/outcomes/states" }],
  }),
});

function StatesIndex() {
  const { sources, courts } = Route.useLoaderData();

  // Group courts -> one row per state; headline = its supreme court's reversal rate.
  const byState = new Map<string, StateRow>();
  for (const c of courts) {
    if (!c.state || !c.state_slug) continue;
    const r = byState.get(c.state_slug) ?? { name: c.state, slug: c.state_slug, supremeRev: null, courts: 0, decided: 0 };
    r.courts += 1;
    r.decided += c.decided_cases ?? 0;
    if (c.court_level === "supreme" && c.reversal_pct != null) r.supremeRev = c.reversal_pct;
    byState.set(c.state_slug, r);
  }
  const states = [...byState.values()].sort(
    (a, b) => (b.supremeRev ?? -1) - (a.supremeRev ?? -1) || a.name.localeCompare(b.name),
  );

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs items={[{ to: "/outcomes", label: "Outcomes" }, { to: "/outcomes/states", label: "States" }]} />
      <header className="mb-7">
        <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
          <Gavel className="h-3.5 w-3.5" /> State appeals
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Do appeals succeed?</h1>
        <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
          When a case reaches a state's highest court, how often does the ruling below get <em>reversed</em>? It swings
          hard by state. The rate shown is each <span className="text-foreground/80">state supreme court</span>'s reversal
          rate among decided appeals; open a state for its intermediate courts too.
        </p>
        <p className="mt-2 text-[13px] text-foreground/60">
          Appellate data, classifier-derived — descriptive, not a prediction about your appeal.
        </p>
      </header>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
        {states.map((s) => (
          <li key={s.slug}>
            <Link
              to={`/outcomes/states/${s.slug}` as never}
              className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-semibold leading-tight">{s.name}</div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.courts} court{s.courts === 1 ? "" : "s"} · {fmt(s.decided)} decided appeals
                </div>
              </div>
              {s.supremeRev != null ? (
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-semibold tabular-nums text-terracotta">{s.supremeRev}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">supreme reversal</div>
                </div>
              ) : (
                <div className="shrink-0 text-[11px] text-muted-foreground">small sample</div>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </ResearchShell>
  );
}
