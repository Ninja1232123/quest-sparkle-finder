import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TOPICS } from "@/data/topics";
import { TopicCard } from "@/components/marginalia/TopicCard";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { AGENCIES } from "@/data/topics";
import heroCollage from "@/assets/hero-collage.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Marginalia — A friendlier law library" },
      {
        name: "description",
        content:
          "Plain-English explainers for federal regulations, IRS manuals, and consumer rules — with a beautiful map of how the rules connect.",
      },
      { property: "og:title", content: "Marginalia — A friendlier law library" },
      {
        property: "og:description",
        content: "Understand the law as a whole, not one statute at a time.",
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <div className="relative z-10">
            <div className="font-display text-xs italic tracking-wide text-accent">
              ✦ vol. 1 · everyday rules, properly read
            </div>
            <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              The law, but{" "}
              <span className="ink-underline italic">readable</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75">
              Marginalia stitches together the federal rulebook, agency manuals, and consumer-protection codes —
              so you can read the rules around your life as one connected story, not a stack of PDFs.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/topic/$slug"
                params={{ slug: "side-hustle-taxes" }}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-base font-medium text-primary-foreground shadow-[var(--shadow-warm)] transition-all hover:scale-[1.02]"
              >
                Start with a story
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                to="/library"
                className="inline-flex items-center gap-2 rounded-full border-2 border-foreground/15 px-6 py-3 font-display text-base text-foreground hover:border-foreground/40"
              >
                Browse the sources
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="font-display italic">connected sources:</span>
              {Object.values(AGENCIES).map((a) => (
                <span key={a.id} className="citation-tag" style={{ color: a.color }}>
                  ● {a.shortName}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2.5rem] opacity-70 blur-2xl"
              style={{ background: "var(--gradient-sunset)" }}
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[2rem] border-2 border-foreground/10 shadow-[var(--shadow-warm)]">
              <img
                src={heroCollage}
                alt="Illustration of a glowing open book with floating documents and constellation lines"
                width={1536}
                height={1152}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden max-w-[220px] rotate-[-3deg] rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] md:block animate-float">
              <div className="citation-tag text-accent">today's note</div>
              <p className="mt-1 font-display text-sm italic leading-snug">
                "Did you know renting your home for fewer than 15 days a year is completely tax-free?"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="citation-tag text-muted-foreground">the table of contents</div>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Stories pulled from the rulebook
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Each topic links the actual citations across agencies — written first in plain English,
              then with the original source one tap away.
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {TOPICS.map((t) => (
            <TopicCard key={t.slug} topic={t} />
          ))}
        </div>
      </section>

      {/* How it reads */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 rounded-3xl border bg-card p-10 paper-grain shadow-[var(--shadow-card)] md:grid-cols-3">
          {[
            {
              n: "i.",
              h: "Read the story",
              p: "Every topic opens with a short, plain-English explainer of how the rules actually work in real life.",
            },
            {
              n: "ii.",
              h: "See the constellation",
              p: "An interactive map shows how citations across the IRS, eCFR, UCC, and FTC connect to one another.",
            },
            {
              n: "iii.",
              h: "Read the source",
              p: "Tap any node to flip between the plain-English summary and the original government text.",
            },
          ].map((step) => (
            <div key={step.n}>
              <div className="font-display text-2xl italic text-accent">{step.n}</div>
              <h3 className="mt-1 font-display text-xl font-semibold">{step.h}</h3>
              <p className="mt-2 text-sm text-foreground/70">{step.p}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
