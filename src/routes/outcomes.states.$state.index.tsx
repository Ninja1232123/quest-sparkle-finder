import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStateCourts } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Crumbs, fmt, StateDataNote } from "@/components/outcomes/ui";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/outcomes/states/$state/")({
  loader: async ({ params }) => {
    const [{ sources }, { courts }] = await Promise.all([
      listSources(),
      getStateCourts({ data: { state_slug: params.state } }),
    ]);
    if (!courts.length) throw notFound();
    return { sources, courts, state: params.state };
  },
  component: StatePage,
  head: ({ loaderData }) => {
    const name = loaderData?.courts?.[0]?.state ?? "State";
    return {
      meta: [
        { title: `${name} appeal outcomes — reversal rates by court · Marginalia` },
        { name: "description", content: `How often ${name}'s supreme and appellate courts reverse the courts below: reversal and remand base rates by court.` },
      ],
      links: [{ rel: "canonical", href: `https://self-law.org/outcomes/states/${loaderData?.state ?? ""}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">No appeal outcomes for this state</h1>
      <Link to="/outcomes/states" className="mt-3 inline-block text-terracotta hover:underline">← All states</Link>
    </div>
  ),
});

function StatePage() {
  const { sources, courts, state } = Route.useLoaderData();
  const name = courts[0]?.state ?? "State";
  // supreme first, then appellate by decided volume
  const ordered = [...courts].sort(
    (a, b) =>
      (a.court_level === "supreme" ? 0 : 1) - (b.court_level === "supreme" ? 0 : 1) ||
      (b.decided_cases ?? 0) - (a.decided_cases ?? 0),
  );

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs
        items={[
          { to: "/outcomes", label: "Outcomes" },
          { to: "/outcomes/states", label: "States" },
          { to: `/outcomes/states/${state}`, label: name },
        ]}
      />
      <header className="mb-7">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{name}</h1>
        <p className="mt-2 text-[0.98rem] text-muted-foreground">
          Appeal outcomes by court. Reversal rate = share of decided appeals where the court below was reversed.
        </p>
      </header>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
        {ordered.map((c) => (
          <li key={c.slug}>
            <Link to={c.slug as never} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-semibold leading-tight">{c.court_name}</div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {c.court_level === "supreme" ? "Court of last resort" : "Intermediate appellate"} · {fmt(c.decided_cases)} decided
                </div>
              </div>
              {c.reversal_pct != null ? (
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-semibold tabular-nums text-terracotta">{c.reversal_pct}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">reversed</div>
                </div>
              ) : (
                <div className="shrink-0 text-[11px] text-muted-foreground">small sample</div>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <StateDataNote />
    </ResearchShell>
  );
}
