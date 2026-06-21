import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatPage, getCaseTypesInCourt } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Crumbs, DataNote, fmt, OutcomeBar } from "@/components/outcomes/ui";
import { ChevronRight, Landmark } from "lucide-react";

export const Route = createFileRoute("/outcomes/federal/court/$court/")({
  loader: async ({ params }) => {
    const slug = `/outcomes/federal/court/${params.court}`;
    const [{ sources }, { page, outcomes }] = await Promise.all([listSources(), getStatPage({ data: { slug } })]);
    if (!page) throw notFound();
    const { caseTypes } = await getCaseTypesInCourt({ data: { court_id: page.court_id ?? "" } });
    return { sources, page, outcomes, caseTypes, court: params.court };
  },
  component: CourtPage,
  head: ({ loaderData }) => {
    const name = loaderData?.page?.court_name ?? "Federal court";
    const title = `${name} — civil case outcomes · Self-Law`;
    const description = `How civil cases close in the ${name}: settlement, dismissal, and plaintiff-win base rates by claim type.`;
    const url = `https://self-law.org/outcomes/federal/court/${loaderData?.court ?? ""}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">No outcomes for this court</h1>
      <Link to="/outcomes" className="mt-3 inline-block text-terracotta hover:underline">← All court outcomes</Link>
    </div>
  ),
});

function CourtPage() {
  const { sources, page, outcomes, caseTypes, court } = Route.useLoaderData();

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs items={[{ to: "/outcomes", label: "Outcomes" }, { to: `/outcomes/federal/court/${court}`, label: page.court_name ?? "Court" }]} />
      <header className="mb-7">
        <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
          <Landmark className="h-3.5 w-3.5" /> Federal court
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">{page.court_name}</h1>
        <p className="mt-2 text-[0.98rem] text-muted-foreground">
          {fmt(page.total_cases)} civil cases closed here. Overall:
        </p>
      </header>

      <section className="mb-9">
        <OutcomeBar rows={outcomes} />
      </section>

      <h2 className="mb-3 font-display text-lg font-semibold">By claim type</h2>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
        {caseTypes.map((ct: any) => (
          <li key={ct.slug}>
            <Link to={ct.slug as never} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-semibold leading-tight">{ct.nos_label}</div>
                <div className="mt-0.5 font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
                  {fmt(ct.total_cases)} cases · {fmt(ct.merits_cases)} decided
                </div>
              </div>
              {ct.plaintiff_win_pct != null ? (
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-semibold tabular-nums text-terracotta">{ct.plaintiff_win_pct}%</div>
                  <div className="text-[12px] uppercase tracking-wide text-muted-foreground">plaintiff win</div>
                </div>
              ) : (
                <div className="shrink-0 text-[12px] text-muted-foreground">small sample</div>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>

      <DataNote />
    </ResearchShell>
  );
}
