import { createFileRoute, Link } from "@tanstack/react-router";
import { AGENCIES, TOPICS } from "@/data/topics";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Building2, Landmark, Gavel, FileSignature, Radio } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";

export const Route = createFileRoute("/library")({
  component: Library,
  head: () => ({
    meta: [
      { title: "Sources · Marginalia" },
      {
        name: "description",
        content: "The agencies and codes Marginalia connects — IRS, eCFR, UCC, FTC, and Treasury.",
      },
      { property: "og:title", content: "Sources · Marginalia" },
      { property: "og:description", content: "Meet the rulebooks behind the explainers." },
      { property: "og:url", content: "https://self-law.org/library" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/library" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Sources · Marginalia",
          description: "Federal agencies and codebooks indexed by Marginalia.",
          url: "https://self-law.org/library",
        }),
      },
    ],
  }),
});

function Library() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="citation-tag text-muted-foreground">the shelf</div>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          The five rulebooks
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-foreground/75">
          Marginalia pulls from these federal sources and weaves them together. Tap any one to see which
          everyday topics it shows up in.
        </p>

        <div className="mt-12 space-y-5">
          {Object.values(AGENCIES).map((a) => {
            const usedIn = TOPICS.filter((t) => t.citations.some((c) => c.agency === a.id));
            return (
              <div
                key={a.id}
                className="group relative overflow-hidden rounded-3xl border bg-card p-7 paper-grain shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5"
              >
                <div
                  className="absolute left-0 top-0 h-full w-1.5"
                  style={{ backgroundColor: a.color }}
                />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="citation-tag" style={{ color: a.color }}>
                      {a.shortName}
                    </div>
                    <h2 className="mt-1 font-display text-3xl font-semibold">{a.name}</h2>
                    <p className="mt-2 max-w-xl text-foreground/75">{a.blurb}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="font-display text-2xl text-foreground">{usedIn.length}</div>
                    topic{usedIn.length === 1 ? "" : "s"}
                  </div>
                </div>
                {usedIn.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {usedIn.map((t) => (
                      <Link
                        key={t.slug}
                        to="/topic/$slug"
                        params={{ slug: t.slug }}
                        className="rounded-full border bg-background px-3 py-1 text-xs hover:border-accent hover:text-accent"
                      >
                        {t.emoji} {t.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}