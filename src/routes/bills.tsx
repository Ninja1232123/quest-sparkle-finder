import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

// Slug is "bills"; the source_code in the corpus is "bill".
export const Route = createFileRoute("/bills")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "bill", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/bills" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Congressional Bills · Self-Law" },
      { name: "description", content: "Search congressional bills and resolutions — proposed federal legislation introduced in the House and Senate, tracked by number." },
      { property: "og:title", content: "Congressional Bills · Self-Law" },
      { property: "og:description", content: "Search congressional bills and resolutions — proposed federal legislation introduced in the House and Senate, tracked by number." },
      { property: "og:url", content: "https://self-law.org/bills" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/bills" }],
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
