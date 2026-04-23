import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AGENCIES, searchAll } from "@/data/topics";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string })?.q ?? "";
    return {
      meta: [
        { title: q ? `"${q}" · Marginalia search` : "Search · Marginalia" },
        { name: "description", content: "Cross-source search across federal regulations, IRS, Treasury, UCC, and FTC rules." },
      ],
    };
  },
});

function SearchPage() {
  const { q } = Route.useSearch();
  const hits = searchAll(q);

  const grouped = {
    topic: hits.filter((h) => h.kind === "topic"),
    citation: hits.filter((h) => h.kind === "citation"),
    term: hits.filter((h) => h.kind === "term"),
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">cross-source search</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {q ? <>Results for <span className="ink-underline italic">"{q}"</span></> : "What do you want to know?"}
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          One index across the eCFR, Internal Revenue Manual, Treasury Financial Manual, Uniform Commercial Code, and FTC rules.
        </p>

        <div className="mt-8">
          <SearchBar autoFocus />
        </div>

        {q && (
          <div className="mt-10 text-sm text-muted-foreground">
            {hits.length === 0 ? (
              <p>
                Nothing matched. Try a broader phrase — try <em>"warranty"</em>, <em>"eviction"</em>, <em>"1692"</em>, or <em>"overtime"</em>.
              </p>
            ) : (
              <p>
                {hits.length} match{hits.length === 1 ? "" : "es"} across {grouped.topic.length} topic
                {grouped.topic.length === 1 ? "" : "s"}, {grouped.citation.length} citation
                {grouped.citation.length === 1 ? "" : "s"}, {grouped.term.length} term
                {grouped.term.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        )}

        {(["topic", "citation", "term"] as const).map((kind) =>
          grouped[kind].length > 0 ? (
            <div key={kind} className="mt-10">
              <div className="citation-tag text-accent">
                {kind === "topic" ? "topics" : kind === "citation" ? "citations" : "defined terms"}
              </div>
              <ul className="mt-3 space-y-3">
                {grouped[kind].map((h, i) => (
                  <li key={i}>
                    <Link
                      to="/topic/$slug"
                      params={{ slug: h.topicSlug }}
                      className="block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex items-center gap-2">
                        {h.agency && (
                          <span
                            className="citation-tag rounded-full border px-2 py-0.5"
                            style={{ color: AGENCIES[h.agency].color, borderColor: AGENCIES[h.agency].color }}
                          >
                            {AGENCIES[h.agency].shortName}
                          </span>
                        )}
                        <span className="font-display text-base font-semibold">{h.label}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground/75">{h.detail}</p>
                      <div className="mt-2 font-display text-xs italic text-muted-foreground">
                        in {h.topicTitle}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
