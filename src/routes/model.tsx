import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/model")({
  loader: async () => {
    const cb = getCodebook("model");
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
