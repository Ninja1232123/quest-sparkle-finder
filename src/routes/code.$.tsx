import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getUscSection } from "@/server/usc.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/code/$")({
  loader: async ({ params }) => {
    const identifier = "/" + params._splat;
    const res = await getUscSection({ data: { identifier } });
    if (!res.section) throw notFound();
    return res;
  },
  component: SectionPage,
  head: ({ loaderData }) => {
    const s = loaderData?.section;
    if (!s) return { meta: [{ title: "Section not found · Marginalia" }] };
    return {
      meta: [
        { title: `${s.title_num} U.S.C. § ${s.section_num} — ${s.heading} · Marginalia` },
        {
          name: "description",
          content: (s.body_text ?? "").slice(0, 155),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Section not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That citation isn't in our index yet. Title 1 is loaded; the rest of the Code is queued.
      </p>
      <Link to="/code" className="mt-6 inline-block underline">
        Back to the Code
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load that section</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function SectionPage() {
  const { section, citations } = Route.useLoaderData();
  if (!section) return null;

  const internal = citations.filter((c) => c.to_section_id);
  const external = citations.filter((c) => !c.to_section_id);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">U.S. Code</Link>
          {" · "}
          Title {section.title_num}
          {section.chapter ? ` · ${section.chapter}` : ""}
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          § {section.section_num}.{" "}
          <span className="ink-underline italic">{section.heading}</span>
        </h1>
        <div className="mt-6 whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-foreground/90">
          {section.body_text}
        </div>

        {internal.length > 0 && (
          <div className="mt-12">
            <div className="citation-tag text-accent">Traces to {internal.length} other section{internal.length === 1 ? "" : "s"}</div>
            <ul className="mt-3 space-y-2">
              {internal.map((c, i) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.to_identifier.replace(/^\//, "") }}
                    className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                  >
                    <div className="font-display text-sm font-semibold">
                      {c.target_heading || c.to_identifier}
                    </div>
                    <div className="citation-tag mt-0.5 text-muted-foreground">
                      {c.to_identifier}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {external.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-muted-foreground">
              {external.length} reference{external.length === 1 ? "" : "s"} outside Title {section.title_num}
            </div>
            <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {external.slice(0, 40).map((c, i) => (
                <li key={i} className="truncate font-mono text-xs">
                  {c.to_identifier}
                </li>
              ))}
            </ul>
            {external.length > 40 && (
              <div className="mt-2 text-xs text-muted-foreground">
                + {external.length - 40} more (will become clickable as more titles load)
              </div>
            )}
          </div>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}