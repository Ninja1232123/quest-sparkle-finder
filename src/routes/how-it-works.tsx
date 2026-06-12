import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { ArrowRight, BarChart3, Search, BookOpen, PencilLine, FolderOpen, Columns } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorks,
  head: () => ({
    meta: [
      { title: "How it works · Self-Law" },
      {
        name: "description",
        content:
          "Search U.S. law, read the real text, write margin notes that become a citation-backed draft, and compare sources side by side.",
      },
      { property: "og:title", content: "How Self-Law works" },
      { property: "og:description", content: "Read the law, make it yours — in five steps." },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/how-it-works" }],
  }),
});

type Step = {
  n: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  img: string;
  alt: string;
  to: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: Search,
    eyebrow: "Search",
    title: "Ask in plain words",
    body:
      "Type a phrase like “debt collection” or a citation like 15 U.S.C. 1692. Marginalia searches every U.S. law at once — the Constitution, the U.S. Code, regulations, all of it. Not ready to search? Pick a codebook up top and just browse.",
    img: "/howitworks/landing.webp",
    alt: "The Marginalia home page with the search bar and codebook navigation highlighted",
    to: "/search",
    cta: "Try a search",
  },
  {
    n: "02",
    icon: BookOpen,
    eyebrow: "Results",
    title: "See what the law actually says",
    body:
      "Results come straight from the source text, grouped by where they live. Tabs and side filters let you narrow by source or court level until you're looking at exactly the right rule — no summary standing in between.",
    img: "/howitworks/search.webp",
    alt: "Search results for “debt collection” with source tabs and filter rail highlighted",
    to: "/search",
    cta: "Open search",
  },
  {
    n: "03",
    icon: PencilLine,
    eyebrow: "Read & annotate",
    title: "Read it — and write in the margin",
    body:
      "Read the law. Consider how it applies to your situation. Write earnestly and factually. Don't try to conform the law to meet your needs. Just keep it simple. This is what it says... This is why it applies... Use @YourCaseName to save your note to that case file,",
    img: "/howitworks/margin.webp",
    alt: "A law section open for reading with the margin-note panel spotlighted",
    to: "/code",
    cta: "Start reading",
  },
  {
    n: "04",
    icon: FolderOpen,
    eyebrow: "My Cases",
    title: "Your notes become a draft",
    body:
      "Every margin note collects in My Cases. Drag them into the order that reads right and you've got a citation-backed rough draft pleading — in your own words. Your argument, with the law to back it.",
    img: "/howitworks/cases.webp",
    alt: "The My Cases page assembling margin notes into a document",
    to: "/cases",
    cta: "See My Cases",
  },
  {
    n: "05",
    icon: Columns,
    eyebrow: "Compare",
    title: "Hold sources side by side",
    body:
      "Compare puts the same question against several sources at once, with matching terms highlighted across columns. Your Desk keeps working notes within reach the whole time.",
    img: "/howitworks/compare.webp",
    alt: "The Compare view with several source columns and the Desk panel",
    to: "/compare",
    cta: "Open Compare",
  },
];

function HowItWorks() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
            <BarChart3 className="h-3.5 w-3.5" /> How it works
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Read the law. Make it yours.
          </h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted-foreground">
            Marginalia is one desk for all of U.S. law — search it, read the real text, write in the margin, and your
            notes turn into a citation-backed draft. Here's the whole thing in five steps.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/code" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 font-display text-sm font-semibold text-background hover:opacity-90">
              Start reading the law <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted-foreground">Everything, for $5/mo.</span>
          </div>
        </header>

        {/* Steps */}
        <div className="mt-14 space-y-16 md:mt-20 md:space-y-24">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const imageFirst = i % 2 === 1; // alternate sides on desktop
            return (
              <section key={s.n} className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
                {/* copy */}
                <div className={imageFirst ? "md:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-4xl font-semibold text-ochre/70 tabular-nums">{s.n}</span>
                    <span className="citation-tag inline-flex items-center gap-1.5 text-terracotta">
                      <Icon className="h-3.5 w-3.5" /> {s.eyebrow}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">{s.title}</h2>
                  <p className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">{s.body}</p>
                  <Link to={s.to as never} className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted/60">
                    {s.cta} <ArrowRight className="h-3.5 w-3.5 text-foreground/40" />
                  </Link>
                </div>
                {/* screenshot */}
                <div className={imageFirst ? "md:order-1" : ""}>
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_18px_50px_-20px_rgba(26,24,20,0.5)]">
                    <img src={s.img} alt={s.alt} width={1200} height={797} loading={i === 0 ? "eager" : "lazy"} className="block w-full" />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Bonus — Court Outcomes (the new layer; no screenshot) */}
        <section className="mt-20 rounded-2xl border border-terracotta/30 bg-terracotta/5 px-6 py-7 md:px-8">
          <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
            <BarChart3 className="h-3.5 w-3.5" /> And when you want the odds
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Court Outcomes</h2>
          <p className="mt-2 max-w-2xl text-[1rem] leading-relaxed text-muted-foreground">
            The law tells you what your rights <em>are</em>. Court Outcomes tells you what usually <em>happens</em> —
            win, settle, and dismissal rates by claim type and federal court, and reversal rates for state appeals.
            Descriptive statistics from millions of closed cases. Never a prediction about yours.
          </p>
          <Link to="/outcomes" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-card px-4 py-2 text-sm font-medium hover:bg-terracotta/10">
            Explore Court Outcomes <ArrowRight className="h-3.5 w-3.5 text-terracotta" />
          </Link>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_18px_50px_-20px_rgba(26,24,20,0.5)]">
            <img
              src="/howitworks/outcomes.webp"
              alt="The Court Outcomes index of federal claim types with a case-type data page layered in — base rates in one view"
              width={1200}
              height={732}
              loading="lazy"
              className="block w-full"
            />
          </div>
        </section>

        {/* Closing */}
        <section className="mt-16 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">That's the whole desk.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[1rem] text-muted-foreground">
            No theories, no spin — the actual law, and the tools to work with it. It's not legal advice. It's your
            right to read the law and argue your own case.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/code" className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 font-display text-sm font-semibold text-background hover:opacity-90">
              Start reading <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/subscribe" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 font-display text-sm font-semibold hover:bg-muted/60">
              Go Pro · $5
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
