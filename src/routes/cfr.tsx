import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

export const Route = createFileRoute("/cfr")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "cfr", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/cfr" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Code of Federal Regulations · Self-Law" },
      { name: "description", content: "Browse the Code of Federal Regulations — administrative rules that implement federal statutes, organized by title and part." },
      { property: "og:title", content: "Code of Federal Regulations · Self-Law" },
      { property: "og:description", content: "Browse the Code of Federal Regulations — administrative rules that implement federal statutes, organized by title and part." },
      { property: "og:url", content: "https://self-law.org/cfr" },
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
