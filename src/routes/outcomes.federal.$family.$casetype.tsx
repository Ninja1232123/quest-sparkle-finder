import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getStatPage, getCourtsForCaseType } from "@/lib/outcomes.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { BigStat, Crumbs, DataNote, FAMILY_META, fmt, OutcomeBar, pct } from "@/components/outcomes/ui";
import { BookOpen, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/outcomes/federal/$family/$casetype")({
  loader: async ({ params }) => {
    const slug = `/outcomes/federal/${params.family}/${params.casetype}`;
    const [{ sources }, { page, outcomes }] = await Promise.all([listSources(), getStatPage({ data: { slug } })]);
    if (!page) throw notFound();
    const { courts } = page.nos_code != null
      ? await getCourtsForCaseType({ data: { nos_code: page.nos_code } })
      : { courts: [] };
    return { sources, page, outcomes, courts, params };
  },
  component: CaseTypePage,
  head: ({ params }) => {
    const fam = FAMILY_META[params.family]?.name ?? "Federal";
    return {
      meta: [
        { title: `${params.casetype.replace(/^\d+-/, "").replace(/-/g, " ")} — federal outcomes · Self-Law` },
        {
          name: "description",
          content: `How ${fam.toLowerCase()} cases of this type close in federal court: plaintiff-win rate, settlement and dismissal base rates, and how it varies by district.`,
        },
      ],
      links: [{ rel: "canonical", href: `https://self-law.org/outcomes/federal/${params.family}/${params.casetype}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">No outcomes for this claim type</h1>
      <Link to="/outcomes" className="mt-3 inline-block text-terracotta hover:underline">← All court outcomes</Link>
    </div>
  ),
});

function CaseTypePage() {
  const { sources, page, outcomes, courts, params } = Route.useLoaderData();
  const famName = FAMILY_META[params.family]?.name ?? page.family ?? "Federal";
  const total = page.total_cases;
  const merits = page.merits_cases;
  const preMerits = total - merits;
  const defPct = merits > 0 ? pct(page.defendant_win, merits) : null;

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Crumbs
        items={[
          { to: "/outcomes", label: "Outcomes" },
          { to: `/outcomes/federal/${params.family}`, label: famName },
          { to: `/outcomes/federal/${params.family}/${params.casetype}`, label: page.nos_label ?? "" },
        ]}
      />
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{page.nos_label}</h1>
        <p className="mt-2 text-[0.98rem] text-muted-foreground">
          Federal civil · {famName} · {fmt(total)} cases filed and closed (1988–present).
        </p>
      </header>

      {/* Headline numbers */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat value={fmt(total)} label="Cases filed" />
        <BigStat value={`${pct(preMerits, total)}%`} label="Ended before a merits judgment" sub={`${fmt(preMerits)} of ${fmt(total)} cases`} />
        <BigStat value={page.plaintiff_win_pct != null ? `${page.plaintiff_win_pct}%` : "—"} label="Plaintiff win" sub={`of ${fmt(merits)} merits judgments`} accent />
        <BigStat value={defPct != null ? `${defPct}%` : "—"} label="Defendant win" sub="of merits judgments" />
      </section>

      {/* The honest framing */}
      <section className="mb-8 rounded-2xl border border-ochre/30 bg-ochre/5 px-5 py-4 text-sm leading-relaxed text-foreground/80">
        Most cases never reach a ruling on the merits. Of {fmt(total)} filed,{" "}
        <span className="font-semibold text-foreground">{pct(preMerits, total)}%</span> closed without one —
        settled, dismissed, transferred, or remanded. The win rates above describe only the {fmt(merits)} that a judge
        actually decided.
      </section>

      {/* Distribution */}
      <section className="mb-9">
        <h2 className="mb-3 font-display text-lg font-semibold">How they closed</h2>
        <OutcomeBar rows={outcomes} />
      </section>

      {/* Venue table */}
      {courts.length > 0 && (
        <section className="mb-9">
          <h2 className="mb-1 font-display text-lg font-semibold">Where you file matters</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">
            The same claim resolves differently across districts. Plaintiff-win rate among merits judgments, busiest courts first.
          </p>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
            {courts.map((ct) => (
              <li key={ct.slug}>
                <Link to={ct.slug as never} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium leading-tight">{ct.court_name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {fmt(ct.total_cases)} cases · {fmt(ct.merits_cases)} decided
                    </div>
                  </div>
                  {ct.plaintiff_win_pct != null ? (
                    <div className="w-14 shrink-0 text-right font-display text-base font-semibold tabular-nums">
                      {ct.plaintiff_win_pct}%
                    </div>
                  ) : (
                    <div className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">—</div>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Moat: read the law behind it */}
      <section className="mb-2">
        <Link
          to="/search"
          search={{ q: page.nos_label ?? "" } as never}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/60"
        >
          <BookOpen className="h-4 w-4 text-terracotta" />
          Read the law behind {page.nos_label?.toLowerCase()}
          <ChevronRight className="h-3.5 w-3.5 text-foreground/40" />
        </Link>
      </section>

      <DataNote />
    </ResearchShell>
  );
}
