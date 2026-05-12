import { createFileRoute, Link } from "@tanstack/react-router";
import { TOPICS } from "@/data/topics";
import { TopicCard } from "@/components/marginalia/TopicCard";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { listSources } from "@/server/documents.functions";
import heroCollage from "@/assets/hero-collage.jpg";

const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};

export const Route = createFileRoute("/")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Marginalia — A citizen's law index" },
      {
        name: "description",
        content:
          "A working research desk for non-lawyers. Search across the eCFR, IRS, Treasury, UCC, and FTC — and see how the rules connect.",
      },
      { property: "og:title", content: "Marginalia — A citizen's law index" },
      {
        property: "og:description",
        content: "If you don't know your rights, you don't have any. Read the law as one connected record.",
      },
    ],
  }),
});

function Index() {
  const { sources } = Route.useLoaderData();
  const totalDocs = sources.reduce((n: number, s: { count: number }) => n + s.count, 0);
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
          <div className="relative z-10">
            <div className="citation-tag text-muted-foreground">Vol. I · the citizen's index</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-[5.25rem]">
              If you don't know your rights,
              <br />
              <span className="ink-underline italic">you don't have any.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-foreground/75">
              Marginalia is a research desk built for the people the law actually applies to.
              Search across federal regulations, agency manuals, and the commercial code as one connected record —
              then trace how a single rule reaches into the rest.
            </p>

            <div className="mt-8">
              <SearchBar />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-display italic">try:</span>
                {["due process", "establishment", "overtime", "warranty", "statute of frauds"].map((s) => (
                  <Link
                    key={s}
                    to="/search"
                    search={{ q: s, source: "" }}
                    className="citation-tag rounded-full border border-border bg-background/60 px-2.5 py-1 hover:border-foreground/40 hover:text-foreground"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="citation-tag">indexed</span>
              <span className="citation-tag text-foreground/80">
                {totalDocs.toLocaleString()} documents
              </span>
              {sources.map((s: { code: string; name: string; count: number }) => (
                <Link
                  key={s.code}
                  to="/code/source/$source"
                  params={{ source: s.code }}
                  className="citation-tag hover:text-foreground"
                >
                  ● {SOURCE_LABELS[s.code] ?? s.name} · {s.count.toLocaleString()}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2rem] opacity-50 blur-2xl"
              style={{ background: "var(--gradient-sage)" }}
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-foreground/15 shadow-[var(--shadow-warm)]">
              <img
                src={heroCollage}
                alt="A reading desk with open volumes of federal regulations, marginal annotations, and connecting lines between citations"
                width={1536}
                height={1152}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          {[
            {
              n: "I.",
              h: "Read primary sources",
              p: "No paraphrase replaces the original. Every claim links back to the actual statute, regulation, or agency manual it came from.",
            },
            {
              n: "II.",
              h: "See how rules connect",
              p: "A statute rarely stands alone. The citation map shows how rules across agencies cross-reference, modify, and depend on one another.",
            },
            {
              n: "III.",
              h: "Build a working understanding",
              p: "The law is intentionally interlocking. Repeated reading across topics is how lay researchers build real fluency.",
            },
          ].map((step) => (
            <div key={step.n} className="border-l border-border pl-5">
              <div className="font-display text-2xl text-accent">{step.n}</div>
              <h3 className="mt-1 font-display text-xl font-semibold">{step.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">{step.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Topics */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-4">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="citation-tag text-muted-foreground">quick browse</div>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              A few starting points
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Hand-curated walkthroughs that thread citations from multiple sources into one readable record.
              Most research starts in the search bar above — these are just a sampler.
            </p>
          </div>
          <Link
            to="/code"
            className="font-display text-sm italic text-accent hover:underline"
          >
            Search the full code →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {TOPICS.map((t) => (
            <TopicCard key={t.slug} topic={t} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
