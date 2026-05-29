import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

export const Route = createFileRoute("/const")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "const", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/const" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
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
