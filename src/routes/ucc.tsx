import { createFileRoute } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";

// The Uniform Commercial Code — the site's highest-traffic search term, so it
// lives at a clean, citation-matching /ucc (moved from /model, which now 301s
// here) and carries extra-rich, keyword-forward meta. See src/lib/doc-seo.ts
// for the per-section title formula ("UCC § 2-207 — …") on the reader pages.
const TITLE = "Uniform Commercial Code (UCC) — Full Text · Self-Law";
const DESCRIPTION =
  "Read the full Uniform Commercial Code (UCC) on Self-Law — every article and " +
  "section, from sales (Article 2) to leases (2A) to secured transactions " +
  "(Article 9). The real statutory text, cross-referenced and searchable — not a summary.";
const URL = "https://self-law.org/ucc";

export const Route = createFileRoute("/ucc")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSourceRoute({ source: "ucc", deps }),
  component: () => <SourceRouteView data={Route.useLoaderData()} linkSelf={{ to: "/ucc" }} />,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: () => ({
    meta: [
      { title: "Uniform Commercial Code | Self-Law" },
      { name: "description", content: "Uniform Commercial Code | Search UCC today | Self-Law" },
      { property: "og:title", content: "Uniform Commercial Code | Self-Law" },
      { property: "og:description", content: "Uniform Commercial Code | Search UCC today | Self-Law" },
      { property: "og:url", content: "https://self-law.org/ucc" },
      { property: "og:type", content: "https://self-law.org/ucc" },
      { name: "twitter:title", content: "Uniform Commercial Code | Self-Law" },
      { name: "twitter:description", content: "Uniform Commercial Code | Search UCC today | Self-Law" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/ucc" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Legislation",
              name: "Uniform Commercial Code",
              alternateName: "UCC",
              legislationJurisdiction: "United States",
              inLanguage: "en",
              url: URL,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Self-Law", item: "https://self-law.org" },
                { "@type": "ListItem", position: 2, name: "Uniform Commercial Code", item: URL },
              ],
            },
          ],
        }),
      },
    ],
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
