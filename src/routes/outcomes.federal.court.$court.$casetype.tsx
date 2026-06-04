import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatPage } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { BigStat, Crumbs, DataNote, familySlugFromName, fmt, OutcomeBar, pct } from "@/components/outcomes/ui";

export const Route = createFileRoute("/outcomes/federal/court/$court/$casetype")({
  loader: async ({ params }) => {
    const slug = `/outcomes/federal/court/${params.court}/${params.casetype}`;
    const [{ sources }, { page, outcomes }] = await Promise.all([listSources(), getStatPage({ data: { slug } })]);
    if (!page) throw notFound();
    // National comparator for the same claim type.
    const famSlug = familySlugFromName(page.family);
    let national: { pct: number | null; slug: string | null } = { pct: null, slug: null };
    if (famSlug) {
      const natSlug = `/outcomes/federal/${famSlug}/${params.casetype}`;
      const { page: np } = await getStatPage({ data: { slug: natSlug } });
      national = { pct: np?.plaintiff_win_pct ?? null, slug: np ? natSlug : null };
    }
    return { sources, page, outcomes, national, params };
  },
  component: CourtCaseTypePage,
  head: ({ loaderData }) => {
    const p = loaderData?.page;
    const name = p ? `${p.nos_label} — ${p.court_name}` : "Federal court outcomes";
    return {
      meta: [
        { title: `${name} · Self-Law` },
        { name: "description", content: `How ${p?.nos_label?.toLowerCase() ?? "these"} cases close in the ${p?.court_name ?? "court"}: plaintiff-win, settlement, and dismissal base rates, versus the national rate.` },
      ],
      links: [{ rel: "canonical", href: `https://self-law.org/outcomes/federal/court/${loaderData?.params?.court ?? ""}/${loaderData?.params?.casetype ?? ""}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">No outcomes for this court &amp; claim</h1>
      <Link to="/outcomes" className="mt-3 inline-block text-terracotta hover:underline">← All court outcomes</Link>
    </div>
  ),
});

function CourtCaseTypePage() {
  const { sources, page, outcomes, national, params } = Route.useLoaderData();
  const famSlug = familySlugFromName(page.family);
  const total = page.total_cases;
  const merits = page.merits_cases;
  const preMerits = total - merits;
  const here = page.plaintiff_win_pct;
  const delta = here != null && national.pct != null ? Math.round((here - national.pct) * 10) / 10 : null;

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs
        items={[
          { to: "/outcomes", label: "Outcomes" },
          { to: `/outcomes/federal/court/${params.court}`, label: page.court_name ?? "Court" },
          { to: `/outcomes/federal/court/${params.court}/${params.casetype}`, label: page.nos_label ?? "" },
        ]}
      />
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{page.nos_label}</h1>
        <p className="mt-1.5 text-[0.98rem] text-muted-foreground">in the {page.court_name}</p>
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat value={fmt(total)} label="Cases" />
        <BigStat value={`${pct(preMerits, total)}%`} label="Ended before merits" sub={`${fmt(preMerits)} of ${fmt(total)} cases`} />
        <BigStat value={here != null ? `${here}%` : "—"} label="Plaintiff win" sub={`of ${fmt(merits)} merits judgments`} accent />
        <BigStat
          value={national.pct != null ? `${national.pct}%` : "—"}
          label="National rate"
          sub={delta != null ? `${delta >= 0 ? "+" : ""}${delta} pts here` : "all federal courts"}
        />
      </section>

      {delta != null && (
        <section className="mb-8 rounded-2xl border border-ochre/30 bg-ochre/5 px-5 py-4 text-sm leading-relaxed text-foreground/80">
          Plaintiffs prevail on the merits{" "}
          <span className="font-semibold text-foreground">
            {delta === 0 ? "at the national rate" : `${Math.abs(delta)} points ${delta > 0 ? "more" : "less"} often`}
          </span>{" "}
          here than across all federal courts
          {national.slug && famSlug ? (
            <>
              {" "}— <Link to={national.slug as never} className="text-terracotta hover:underline">see every district</Link>.
            </>
          ) : (
            "."
          )}
        </section>
      )}

      <section className="mb-9">
        <h2 className="mb-3 font-display text-lg font-semibold">How they closed</h2>
        <OutcomeBar rows={outcomes} />
      </section>

      <DataNote />
    </ResearchShell>
  );
}
