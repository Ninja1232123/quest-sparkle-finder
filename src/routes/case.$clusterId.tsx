import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { fetchCaseOpinion, courtDisplay, type ClOpinion } from "@/lib/court-cases";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SITE_BRAND } from "@/lib/doc-seo";
import { ExternalLink, Landmark, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { SendToWorkspaceButton } from "@/components/workspace/SendToWorkspaceButton";

// Words of opinion text to show per page chunk.
const CHARS_PER_PAGE = 12000;

function OpinionBody({ text }: { text: string }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(text.length / CHARS_PER_PAGE);
  const chunk = text.slice(page * CHARS_PER_PAGE, (page + 1) * CHARS_PER_PAGE);

  // Split into paragraphs for readable rendering.
  const paragraphs = chunk
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);

  return (
    <div>
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed text-foreground/85">
            {p}
          </p>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-border/40 pt-5">
          <button
            type="button"
            onClick={() => { setPage((v) => Math.max(0, v - 1)); window.scrollTo(0, 0); }}
            disabled={page === 0}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:border-border/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="citation-tag text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => { setPage((v) => Math.min(totalPages - 1, v + 1)); window.scrollTo(0, 0); }}
            disabled={page === totalPages - 1}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:border-border/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function CaseReaderPage() {
  const { opinion } = Route.useLoaderData();
  const { clusterId } = Route.useParams();

  if (!opinion) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Landmark className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg font-display font-semibold text-foreground/70">Case not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This case may not be in the local database yet, or the ID is invalid.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Self-Law
          </a>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const {
    case_name, court, date_filed, cite_count, outcome, cl_url, text,
  } = opinion;

  const courtLabel = courtDisplay(court);
  const year = date_filed?.slice(0, 4);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Back nav */}
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        {/* Case header */}
        <header className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Landmark className="h-4 w-4 shrink-0 text-accent" />
            <span className="citation-tag text-muted-foreground">
              {[courtLabel, year].filter(Boolean).join(" · ")}
            </span>
            {cite_count > 0 && (
              <span className="citation-tag text-muted-foreground">
                · {cite_count.toLocaleString()} citations
              </span>
            )}
            {outcome && (
              <span className="rounded-full bg-ochre/15 px-2 py-0.5 text-[11px] font-medium text-ochre">
                {outcome}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold leading-snug text-foreground">
            {case_name}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <a
              href={cl_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border/80 hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Full opinion on CourtListener
            </a>
            <SendToWorkspaceButton
              identifier={`case/${clusterId}`}
              citation={case_name}
              heading={courtLabel ? `${courtLabel}${year ? ` · ${year}` : ""}` : null}
              excerpt={text ? text.slice(0, 800) : undefined}
            />
          </div>
        </header>

        {/* Opinion text */}
        <div className="rounded-2xl border border-border/60 bg-card px-6 py-6">
          {text ? (
            <OpinionBody text={text} />
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Opinion text not available in the local database.
              </p>
              <a
                href={cl_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Read on CourtListener <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Footer CL attribution */}
        <p className="mt-6 citation-tag text-center text-muted-foreground/60">
          Case data via{" "}
          <a href="https://www.courtlistener.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted-foreground">
            CourtListener
          </a>
          {" "}· Ask Juri to search and analyze this case
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/case/$clusterId")({
  loader: async ({ params }) => {
    const cluster_id = Number(params.clusterId);
    if (!cluster_id || !Number.isInteger(cluster_id) || cluster_id <= 0) throw notFound();
    const res = await fetchCaseOpinion({ data: { cluster_id } });
    return res;
  },
  component: CaseReaderPage,
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </article>
    </div>
  ),
  head: ({ loaderData }) => {
    const op = loaderData?.opinion;
    if (!op) return { meta: [{ title: `Case not found · ${SITE_BRAND}` }] };
    const court = courtDisplay(op.court);
    const year = op.date_filed?.slice(0, 4);
    const subtitle = [court, year].filter(Boolean).join(", ");
    return {
      meta: [
        { title: `${op.case_name}${subtitle ? ` (${subtitle})` : ""} · ${SITE_BRAND}` },
        { name: "description", content: `Read the full opinion: ${op.case_name}${subtitle ? ` — ${subtitle}` : ""}. ${op.cite_count} citations.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
});
