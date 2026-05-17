import { createFileRoute, notFound } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { CodebookLanding } from "@/components/marginalia/CodebookLanding";
import { getCodebook } from "@/lib/codebooks";

export const Route = createFileRoute("/register")({
  loader: async () => {
    const cb = getCodebook("register");
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
      { title: "Federal Register · Marginalia" },
      { name: "description", content: "Daily rules, proposed rules, and notices from federal agencies." },
      { property: "og:title", content: "Federal Register · Marginalia" },
      { property: "og:description", content: "Daily rules, proposed rules, and notices from federal agencies." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/register" }],
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
