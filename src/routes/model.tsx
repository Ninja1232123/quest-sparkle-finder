import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources, getSourceTOC } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

// Model & Uniform Codes — currently houses the UCC (source code "ucc").
// We load the UCC TOC as the primary so the sub-volume grid populates with
// UCC articles. When more model codes land (UPC, etc.) revisit this.
export const Route = createFileRoute("/model")({
  loader: async () => {
    const cb = getCodebook("model");
    if (!cb) throw notFound();
    const primary = cb.sources[0] ?? "ucc";
    const [{ sources }, tocRes] = await Promise.all([
      listSources(),
      getSourceTOC({ data: { source: primary } }),
    ]);
    return { codebook: cb, sources, toc: tocRes.toc, tocSource: primary };
  },
  component: () => {
    const { codebook, sources, toc, tocSource } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} toc={toc} tocSource={tocSource} />;
  },
  head: () => ({
    meta: [
      { title: "Model & Uniform Codes · Marginalia" },
      { name: "description", content: "Model commercial law and uniform acts adopted by the states." },
      { property: "og:title", content: "Model & Uniform Codes · Marginalia" },
      { property: "og:description", content: "Model commercial law and uniform acts adopted by the states." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/model" }],
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
