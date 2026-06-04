import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatPage, getCaseTypesInFamily } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Crumbs, DataNote, FAMILY_META, fmt, OutcomeBar } from "@/components/outcomes/ui";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/outcomes/federal/$family/")({
  loader: async ({ params }) => {
    const slug = `/outcomes/federal/${params.family}`;
    const [{ sources }, { page, outcomes }] = await Promise.all([listSources(), getStatPage({ data: { slug } })]);
    if (!page) throw notFound();
    const { caseTypes } = await getCaseTypesInFamily({ data: { family: page.family ?? "" } });
    return { sources, page, outcomes, caseTypes, familySlug: params.family };
  },
  component: FamilyPage,
  head: ({ params }) => {
    const meta = FAMILY_META[params.family];
    const name = meta?.name ?? "Federal";
    return {
      meta: [
        { title: `${name} — federal case outcomes · Self-Law` },
        { name: "description", content: `${meta?.blurb ?? ""} How ${name.toLowerCase()} cases close in federal court: win, settle, dismiss base rates by claim type.` },
      ],
      links: [{ rel: "canonical", href: `https://self-law.org/outcomes/federal/${params.family}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">No outcomes for this category</h1>
      <Link to="/outcomes" className="mt-3 inline-block text-terracotta hover:underline">← All court outcomes</Link>
    </div>
  ),
});

function FamilyPage() {
  const { sources, page, outcomes, caseTypes, familySlug } = Route.useLoaderData();
  const meta = FAMILY_META[familySlug];
  const name = meta?.name ?? page.family ?? "Federal";

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs items={[{ to: "/outcomes", label: "Outcomes" }, { to: `/outcomes/federal/${familySlug}`, label: name }]} />
      <header className="mb-7">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{name}</h1>
        {meta?.blurb && <p className="mt-2 text-[0.98rem] text-muted-foreground">{meta.blurb}</p>}
        <p className="mt-3 text-sm text-foreground/70">
          {fmt(page.total_cases)} federal civil cases in this category. Across all of them:
        </p>
      </header>

      <section className="mb-9">
        <OutcomeBar rows={outcomes} />
      </section>

      <h2 className="mb-3 font-display text-lg font-semibold">By claim type</h2>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
        {caseTypes.map((ct) => (
          <li key={ct.slug}>
            <Link to={ct.slug as never} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-semibold leading-tight">{ct.nos_label}</div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {fmt(ct.total_cases)} cases · {fmt(ct.merits_cases)} reached a judgment
                </div>
              </div>
              {ct.plaintiff_win_pct != null ? (
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-semibold tabular-nums text-terracotta">{ct.plaintiff_win_pct}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">plaintiff win</div>
                </div>
              ) : (
                <div className="shrink-0 text-[11px] text-muted-foreground">small sample</div>
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
