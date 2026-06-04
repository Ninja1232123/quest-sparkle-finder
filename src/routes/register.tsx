import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

export const Route = createFileRoute("/register")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "register", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/register" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Federal Register · Self-Law" },
      { name: "description", content: "Daily rules, proposed rules, and notices from federal agencies." },
      { property: "og:title", content: "Federal Register · Self-Law" },
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
