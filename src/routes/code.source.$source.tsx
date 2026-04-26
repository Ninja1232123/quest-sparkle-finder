import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listDocumentsBySource } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
};

export const Route = createFileRoute("/code/source/$source")({
  loader: async ({ params }) => {
    const { documents, error } = await listDocumentsBySource({ data: { source: params.source } });
    if (error) throw new Error(error);
    if (documents.length === 0) throw notFound();
    return { documents, source: params.source };
  },
  component: SourceBrowser,
  head: ({ params }) => ({
    meta: [
      { title: `${SOURCE_NAMES[params.source] ?? params.source.toUpperCase()} · Marginalia` },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Source not found</h1>
      <Link to="/code" className="mt-4 inline-block underline">Back to all sources</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this source</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

type DocLite = {
  id: string;
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
};

function SourceBrowser() {
  const { documents, source } = Route.useLoaderData();
  const sourceName = SOURCE_NAMES[source] ?? source.toUpperCase();

  // Group by parent_label so the user gets a real outline.
  const groups = new Map<string, DocLite[]>();
  for (const d of documents as DocLite[]) {
    const k = d.parent_label ?? "Other";
    const arr = groups.get(k) ?? [];
    arr.push(d);
    groups.set(k, arr);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">All sources</Link> · {documents.length} documents
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="ink-underline italic">{sourceName}</span>
        </h1>

        <div className="mt-10 space-y-10">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="citation-tag text-accent">{group}</div>
              <ul className="mt-3 divide-y divide-border/60 rounded-2xl border bg-card">
                {items.map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/code/$"
                      params={{ _splat: d.identifier.replace(/^\//, "") }}
                      className="flex items-baseline gap-4 px-5 py-3 hover:bg-muted/60"
                    >
                      <span className="citation-tag w-28 shrink-0 text-muted-foreground">
                        {d.section_label ?? ""}
                      </span>
                      <span className="font-display text-sm font-semibold">{d.heading}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
