import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

// Slug is "laws"; the source_code in the corpus is "public-private-law".
export const Route = createFileRoute("/laws")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "public-private-law", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/laws" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Public & Private Laws · Self-Law" },
      { name: "description", content: "Bills enacted into law, by Congress and number." },
      { property: "og:title", content: "Public & Private Laws · Self-Law" },
      { property: "og:description", content: "Bills enacted into law, by Congress and number." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/laws" }],
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
