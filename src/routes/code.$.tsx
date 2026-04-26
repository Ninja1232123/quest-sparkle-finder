import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getDocument, type DocCitationRow } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/code/$")({
  loader: async ({ params }) => {
    const identifier = "/" + params._splat;
    const res = await getDocument({ data: { identifier } });
    if (!res.document) throw notFound();
    return res;
  },
  component: DocumentPage,
  head: ({ loaderData }) => {
    const d = loaderData?.document;
    if (!d) return { meta: [{ title: "Not found · Marginalia" }] };
    const title = `${d.section_label ?? ""} ${d.heading ?? ""}`.trim();
    return {
      meta: [
        { title: `${title} — ${d.parent_label ?? ""} · Marginalia` },
        { name: "description", content: (d.body_text ?? "").slice(0, 155) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Document not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That citation isn't in our index yet.
      </p>
      <Link to="/code" className="mt-6 inline-block underline">Back to the Code</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load that document</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

const SOURCE_NAMES: Record<string, string> = {
  const: "Constitution",
  usc: "U.S. Code",
  ucc: "UCC",
  tfm: "TFM",
};

function DocumentPage() {
  const { document, citations, incoming } = Route.useLoaderData();
  if (!document) return null;

  const internal = citations.filter((c: DocCitationRow) => c.to_document_id);
  const external = citations.filter((c: DocCitationRow) => !c.to_document_id);

  // Group internal traces by source for clarity
  const traceBySource = new Map<string, DocCitationRow[]>();
  for (const c of internal) {
    const k = c.target_source ?? "?";
    const arr = traceBySource.get(k) ?? [];
    arr.push(c);
    traceBySource.set(k, arr);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">The Code</Link>
          {document.parent_label ? <> · <Link to="/code/source/$source" params={{ source: document.source_code }} className="hover:text-foreground">{document.parent_label}</Link></> : null}
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {document.section_label ? <span className="text-foreground/60">{document.section_label}. </span> : null}
          <span className="ink-underline italic">{document.heading}</span>
        </h1>
        {document.word_count ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {document.word_count.toLocaleString()} words
          </div>
        ) : null}
        <div className="mt-6 whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-foreground/90">
          {document.body_text}
        </div>

        {internal.length > 0 && (
          <div className="mt-12">
            <div className="citation-tag text-accent">
              Traces to {internal.length} document{internal.length === 1 ? "" : "s"}
            </div>
            <div className="mt-3 space-y-6">
              {Array.from(traceBySource.entries()).map(([src, items]) => (
                <div key={src}>
                  <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {SOURCE_NAMES[src] ?? src}
                  </div>
                  <ul className="space-y-2">
                    {items.map((c, i) => (
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
                            {c.target_section_label ?? c.to_identifier}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {incoming.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-accent">
              Cited by {incoming.length} document{incoming.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-3 space-y-2">
              {incoming.map((c, i) => (
                <li key={i}>
                  <Link
                    to="/code/$"
                    params={{ _splat: c.identifier.replace(/^\//, "") }}
                    className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted/60"
                  >
                    <div className="citation-tag text-muted-foreground">
                      {SOURCE_NAMES[c.source] ?? c.source}{c.section_label ? ` · ${c.section_label}` : ""}
                    </div>
                    <div className="font-display text-sm font-semibold">{c.heading}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {external.length > 0 && (
          <div className="mt-10">
            <div className="citation-tag text-muted-foreground">
              {external.length} reference{external.length === 1 ? "" : "s"} not yet in our index
            </div>
            <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {external.slice(0, 40).map((c: DocCitationRow, i: number) => (
                <li key={i} className="truncate font-mono text-xs">{c.to_identifier}</li>
              ))}
            </ul>
            {external.length > 40 && (
              <div className="mt-2 text-xs text-muted-foreground">
                + {external.length - 40} more
              </div>
            )}
          </div>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}
