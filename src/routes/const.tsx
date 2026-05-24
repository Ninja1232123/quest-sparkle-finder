import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/const")({
  loader: async () => {
    const cb = getCodebook("const");
    if (!cb) throw notFound();
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: "const" } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: "const" };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "U.S. Constitution · Marginalia" },
      { name: "description", content: "The founding charter — articles and amendments." },
      { property: "og:title", content: "U.S. Constitution · Marginalia" },
      { property: "og:description", content: "The founding charter — articles and amendments." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/const" }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this codebook</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Codebook not found</h1>
    </div>
  ),
});
