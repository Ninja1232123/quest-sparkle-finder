import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/usc")({
  loader: async () => {
    const cb = getCodebook("usc");
    if (!cb) throw notFound();
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: "usc" } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: "usc" };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "U.S. Code · Marginalia" },
      { name: "description", content: "Federal statutory law, organized by title." },
      { property: "og:title", content: "U.S. Code · Marginalia" },
      { property: "og:description", content: "Federal statutory law, organized by title." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/usc" }],
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
