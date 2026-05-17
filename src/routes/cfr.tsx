import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/cfr")({
  loader: async () => {
    const cb = getCodebook("cfr");
    if (!cb) throw notFound();
    const { sources } = await listSources();
    return { codebook: cb, sources };
  },
  component: () => {
    const { codebook, sources } = Route.useLoaderData();
    return <CodebookLanding codebook={codebook} sources={sources} />;
  },
  head: () => ({
    meta: [
      { title: "Code of Federal Regulations · Marginalia" },
      { name: "description", content: "The rulebook that implements federal statutes." },
      { property: "og:title", content: "Code of Federal Regulations · Marginalia" },
      { property: "og:description", content: "The rulebook that implements federal statutes." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/cfr" }],
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
