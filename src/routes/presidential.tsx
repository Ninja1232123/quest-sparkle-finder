import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

// Slug is "presidential"; the source_code in the corpus is "public-papers-president".
export const Route = createFileRoute("/presidential")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "public-papers-president", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/presidential" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Presidential Documents · Self-Law" },
      { name: "description", content: "Executive orders, proclamations, and public papers." },
      { property: "og:title", content: "Presidential Documents · Self-Law" },
      { property: "og:description", content: "Executive orders, proclamations, and public papers." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/presidential" }],
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
