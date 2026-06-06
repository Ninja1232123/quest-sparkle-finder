import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatPage } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { BigStat, Crumbs, fmt, OutcomeBar, StateDataNote } from "@/components/outcomes/ui";

export const Route = createFileRoute("/outcomes/states/$state/$court")({
  loader: async ({ params }) => {
    const slug = `/outcomes/states/${params.state}/${params.court}`;
    const [{ sources }, { page, outcomes }] = await Promise.all([listSources(), getStatPage({ data: { slug } })]);
    if (!page) throw notFound();
    return { sources, page, outcomes, params };
  },
  component: StateCourtPage,
  head: ({ loaderData }) => {
    const p = loaderData?.page;
    const name = p?.court_name ?? "State court";
    const title = `${name} — appeal outcomes · Self-Law`;
    const description = `How often the ${name} reverses the court below: reversal rate, remand rate, and the full outcome breakdown of its decided appeals.`;
    const url = `https://self-law.org/outcomes/states/${loaderData?.params?.state ?? ""}/${loaderData?.params?.court ?? ""}`;
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
      <h1 className="font-display text-2xl">No appeal outcomes for this court</h1>
      <Link to="/outcomes/states" className="mt-3 inline-block text-terracotta hover:underline">← All states</Link>
    </div>
  ),
});

function StateCourtPage() {
  const { sources, page, outcomes, params } = Route.useLoaderData();
  const isSupreme = page.court_level === "supreme";

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs
        items={[
          { to: "/outcomes", label: "Outcomes" },
          { to: "/outcomes/states", label: "States" },
          { to: `/outcomes/states/${params.state}`, label: page.state ?? "" },
          { to: `/outcomes/states/${params.state}/${params.court}`, label: page.court_name ?? "" },
        ]}
      />
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{page.court_name}</h1>
        <p className="mt-1.5 text-[0.98rem] text-muted-foreground">
          {isSupreme ? "Court of last resort" : "Intermediate appellate court"} · {page.state}
        </p>
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat value={fmt(page.total_cases)} label="Cases" />
        <BigStat value={fmt(page.decided_cases)} label="Decided (affirmed/reversed)" />
        <BigStat value={page.reversal_pct != null ? `${page.reversal_pct}%` : "—"} label="Reversed" sub="of decided appeals" accent />
        <BigStat value={page.remand_pct != null ? `${page.remand_pct}%` : "—"} label="Remanded" sub="of all cases" />
      </section>

      <section className="mb-8 rounded-2xl border border-ochre/30 bg-ochre/5 px-5 py-4 text-sm leading-relaxed text-foreground/80">
        A reversal means this court overturned the ruling below.{" "}
        {page.reversal_pct != null ? (
          <>
            Among the {fmt(page.decided_cases)} appeals it decided,{" "}
            <span className="font-semibold text-foreground">{page.reversal_pct}%</span> were reversed
            {isSupreme ? " — courts of last resort often take a case precisely to reverse it." : "."}
          </>
        ) : (
          <>Too few decided appeals here to report a stable reversal rate.</>
        )}
      </section>

      <section className="mb-9">
        <h2 className="mb-3 font-display text-lg font-semibold">How these appeals were decided</h2>
        <OutcomeBar rows={outcomes} />
      </section>

      <StateDataNote />
    </ResearchShell>
  );
}
