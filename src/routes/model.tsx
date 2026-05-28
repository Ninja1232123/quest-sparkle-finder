import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

// Model & Uniform Codes — currently houses the UCC (source code "ucc").
// When more model codes land (UPC, etc.) this becomes a chooser landing.
export const Route = createFileRoute("/model")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "ucc", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/model" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
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
