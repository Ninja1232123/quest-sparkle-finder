import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { loadSourceRoute, validateSourceSearch } from "@/lib/source-browser";
import { SourceRouteView, SourceBrowserPending } from "@/components/marginalia/SourceBrowser";
import { cleanPathForSource } from "@/lib/codebooks";
import { sourceName } from "@/lib/source-groups";

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  const: "Browse the United States Constitution article by article — every clause, amendment, and ratification, indexed and cross-referenced on Self-Law.",
  usc: "Browse the United States Code on Self-Law — every title and section of federal statutory law, searchable and cross-linked to the regulations that implement it.",
  cfr: "Browse the Code of Federal Regulations on Self-Law — every title and part of the rules federal agencies enforce, threaded to the statutes that authorize them.",
  ucc: "Browse the Uniform Commercial Code on Self-Law — the model commercial-law statute behind contracts, sales, leases, and secured transactions across U.S. states.",
  tfm: "Browse the Treasury Financial Manual on Self-Law — the federal government's accounting and disbursing rulebook for agencies that handle public money.",
  irm: "Browse the Internal Revenue Manual on Self-Law — the IRS's internal procedures for examinations, collections, appeals, and taxpayer rights.",
};

export const Route = createFileRoute("/code/source/$source")({
  validateSearch: validateSourceSearch,
  loaderDeps: ({ search }) => search,
  // Single-source codebooks have a clean slug (/usc, /cfr, …) that is now the
  // canonical full browser — permanently redirect there, preserving drill-down
  // search params. Multi-source members (irm, tfm, statutes-*) have no clean
  // slug and fall through to render here.
  beforeLoad: ({ params, search }) => {
    const clean = cleanPathForSource(params.source);
    if (clean) throw redirect({ to: clean as never, search, statusCode: 301 });
  },
  loader: ({ params, deps }) => loadSourceRoute({ source: params.source, deps }),
  component: SourceRoute,
  pendingMs: 200,
  pendingComponent: SourceBrowserPending,
  head: ({ params }) => {
    const name = sourceName(params.source);
    const title = `${name} · Self-Law`;
    const description =
      SOURCE_DESCRIPTIONS[params.source] ??
      `Browse ${name} on Self-Law — A legal research tool designed for pro se litigants. All of the law in one place.`;
    const url = `https://self-law.org/code/source/${params.source}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Source not found</h1>
      <Link to="/code" className="mt-4 inline-block underline">Back to all sources</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load this source</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function SourceRoute() {
  const { source } = Route.useParams();
  const data = Route.useLoaderData();
  return <SourceRouteView data={data} linkSelf={{ to: `/code/source/${source}` }} />;
}
