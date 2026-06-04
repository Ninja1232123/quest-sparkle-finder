import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { getOpinion } from "@/lib/opinions.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { Crumbs } from "@/components/outcomes/ui";

export const Route = createFileRoute("/record/$slug")({
  loader: async ({ params }) => {
    const [{ sources }, { opinion }] = await Promise.all([listSources(), getOpinion({ data: { slug: params.slug } })]);
    if (!opinion) throw notFound();
    return { sources, opinion };
  },
  component: OpinionReader,
  head: ({ loaderData }) => {
    const o = loaderData?.opinion;
    const cite = o?.us_cite ? `${o.us_cite}${o.year ? ` (${o.year})` : ""}` : "";
    return {
      meta: [
        { title: `${o?.case_title ?? "Opinion"}${cite ? ` — ${cite}` : ""} · Self-Law` },
        { name: "description", content: `Full text of the U.S. Supreme Court opinion in ${o?.case_title ?? "this case"}${cite ? `, ${cite}` : ""}. Public-domain court record.` },
      ],
      links: [{ rel: "canonical", href: `https://self-law.org/record/${loaderData?.opinion?.slug ?? ""}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Opinion not found</h1>
      <Link to="/record" className="mt-3 inline-block text-terracotta hover:underline">← Court Record</Link>
    </div>
  ),
});

function OpinionReader() {
  const { sources, opinion } = Route.useLoaderData();
  // Old reporter text — split into paragraphs where blank lines exist, else
  // fall back to one block (whitespace preserved by the prose container).
  const paras = opinion.body_text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-3xl">
      <Crumbs items={[{ to: "/record", label: "Court Record" }, { to: `/record/${opinion.slug}`, label: opinion.case_title }]} />
      <header className="mb-6 border-b border-border/60 pb-5">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{opinion.case_title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted-foreground">
          {opinion.us_cite && <span className="text-foreground/70">{opinion.us_cite}</span>}
          {opinion.year && <span>· {opinion.year}</span>}
          <span>· U.S. Supreme Court</span>
          {opinion.cited_count > 0 && <span>· cites {opinion.cited_count} cases</span>}
        </div>
      </header>

      <article className="prose-opinion max-w-none whitespace-pre-wrap font-serif text-[1.02rem] leading-[1.75] text-foreground/90">
        {paras.length > 1 ? paras.map((p, i) => <p key={i} className="mb-4">{p}</p>) : opinion.body_text}
      </article>

      <p className="mt-10 border-t border-border/50 pt-4 text-[12px] leading-relaxed text-muted-foreground">
        Public-domain opinion of the United States Supreme Court, reproduced from the court record (U.S. Reports).
        Historical text may contain OCR artifacts. Provided for reference — not legal advice.
      </p>
    </ResearchShell>
  );
}
