import { createFileRoute, Link } from "@tanstack/react-router";
import { TOPICS } from "@/data/topics";
import { TopicCard } from "@/components/marginalia/TopicCard";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { listSources } from "@/lib/documents.functions";
import heroCollage from "@/assets/hero-collage.jpg";
import { GitCompare, Highlighter, FileDown, Bell, Zap, Map, Brain, Network, Scale, Calendar, GraduationCap } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";

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
          "Cross-reference the Constitution, U.S. Code, CFR, UCC, TFM, and IRM in one place. Real law, no theories.",
      },
      { property: "og:title", content: "Marginalia — A citizen's law index" },
      {
        property: "og:description",
        content: "If you don't know your rights, you don't have any. Read the law as one connected record.",
      },
      { property: "og:url", content: "https://self-law.org/" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/" }],
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
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
          <div className="relative z-10">
            <div className="citation-tag text-muted-foreground">Vol. I · the citizen's index</div>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-[5.25rem]">
              Marginalia — <span className="ink-underline italic">A citizen's law index</span>
            </h1>
            <p className="mt-5 max-w-xl font-display text-2xl italic text-foreground/70 md:text-3xl">
              If you don't know your rights, you don't have any.
            </p>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-foreground/75">
              Six federal codebooks — Constitution, U.S. Code, CFR, UCC, TFM, IRM — indexed together,
              cross-referenced, and searchable in one place. No summaries. No gurus. Just the source.
            </p>

            <div className="mt-8">
              <SearchBar />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-display italic">try:</span>
                {["due process", "right to cure", "15 USC 1692", "4th amendment", "commercial paper"].map((s) => (
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

            <div className="mt-10 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="citation-tag font-semibold text-foreground/80">
                  {totalDocs.toLocaleString()} documents indexed
                </span>
                <span className="citation-tag rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-700 dark:text-green-400 font-medium">
                  ✓ Updated May 2026 · direct from source
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((s: { code: string; name: string; count: number }) => (
                  <Link
                    key={s.code}
                    to="/code/source/$source"
                    params={{ source: s.code }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-foreground/70 hover:border-foreground/40 hover:text-foreground transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {SOURCE_LABELS[s.code] ?? s.name}
                    <span className="font-mono text-muted-foreground/60">{s.count.toLocaleString()}</span>
                  </Link>
                ))}
              </div>
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
                alt="Federal regulations open on a research desk with citation connections visible"
                width={1536}
                height={1152}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Compare Mode CTA banner */}
      <section className="border-b border-border/60 bg-gradient-to-r from-sage-deep/5 to-terracotta/5">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="citation-tag text-sage-deep flex items-center gap-1.5">
                <GitCompare className="h-3.5 w-3.5" />
                new · side-by-side compare
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                The same term across every codebook, at once.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm text-foreground/65">
                Type one search. See how the Constitution, U.S. Code, CFR, and UCC each handle it — in
                split panes with matched sections highlighted. Spot the gaps. Find the authority.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end shrink-0">
              <Link
                to="/compare"
                search={{ q: "due process", sources: "const,usc,cfr" }}
                className="inline-flex items-center gap-2 rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 whitespace-nowrap"
              >
                <GitCompare className="h-4 w-4" />
                Try Compare Mode
              </Link>
              <Link
                to="/compare"
                className="text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Open blank →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <div className="citation-tag text-muted-foreground">the method</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            How Marginalia works
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            {
              n: "I.",
              h: "Read primary sources",
              p: "No paraphrase replaces the original. Every result links back to the actual statute, regulation, or agency manual it came from. No second-hand interpretations.",
            },
            {
              n: "II.",
              h: "Trace the connections",
              p: "A statute rarely stands alone. The citation graph shows how rules across agencies cross-reference, modify, and depend on each other — visually.",
            },
            {
              n: "III.",
              h: "Build your case",
              p: "Save citations to private Case folders. Annotate sections with your own notes. Export to PDF. Your research, organized the way you need it.",
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

      {/* Browse the Code (primary CTA) */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="citation-tag text-muted-foreground">primary sources</div>
             <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
               Open the <span className="ink-underline italic">Code</span>.
             </h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Six codebooks, indexed and cross-linked. Browse the table of contents or jump in by citation.
            </p>
          </div>
          <Link
            to="/code"
            className="rounded-full bg-foreground px-5 py-2.5 font-display text-sm text-background hover:opacity-90"
          >
            Open The Code →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s: { code: string; name: string; count: number }) => (
            <Link
              key={s.code}
              to="/code/source/$source"
              params={{ source: s.code }}
              className="group rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="citation-tag text-accent">{s.count.toLocaleString()} documents</div>
              <div className="mt-1 font-display text-lg font-semibold">{SOURCE_LABELS[s.code] ?? s.name}</div>
              <div className="mt-3 font-mono text-xs text-muted-foreground group-hover:text-foreground/70">
                Browse →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Pro features pitch */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-sage-deep/20 bg-gradient-to-br from-sage-deep/5 to-background p-8 paper-grain shadow-[var(--shadow-soft)] md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="citation-tag text-sage-deep">Pro · $5/month</div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                The full research desk.
              </h2>
              <p className="mt-3 text-foreground/70">
                Every codebook is free to read. The power tools are $5/month. Less than a cup of coffee.
                More useful than a lawyer's first call.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { icon: GitCompare, label: "Side-by-side compare" },
                  { icon: Highlighter, label: "Highlight & annotate" },
                  { icon: FileDown, label: "Export to PDF" },
                  { icon: Bell, label: "Keyword alerts" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Icon className="h-4 w-4 shrink-0 text-sage-deep" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Link
                to="/subscribe"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sage-deep px-6 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-warm)] hover:opacity-90 transition-opacity"
              >
                <Zap className="h-4 w-4" />
                Go Pro — $5/mo
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Free account first →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Topics — samplers */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-4">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="citation-tag text-muted-foreground">curated walkthroughs</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Topic samplers
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-foreground/65">
              Hand-threaded readings that trace a single issue across multiple codebooks.
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {TOPICS.map((t) => (
            <TopicCard key={t.slug} topic={t} />
          ))}
        </div>
      </section>

      {/* Vision strip — make the "what could be" tangible */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <ComingSoonHeader
          eyebrow="vol. ii · the build list"
          title="What this becomes once we get there."
          subtitle="The federal floor is live. These are the rooms we haven't built out yet — locked for now, but on the blueprint."
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComingSoonCard
            icon={Map}
            status="building"
            title="All 50 states, indexed"
            pitch="Every state code, every state constitution, every state regulation — rolled into the same search bar. Start federal, finish in Wyoming, never leave the page."
          />
          <ComingSoonCard
            icon={Brain}
            status="building"
            title="Plain-English mode"
            pitch="A toggle that translates any statute or rule into everyday language, side-by-side with the original. The law stays the law — you just get a translator."
          />
          <ComingSoonCard
            icon={Network}
            status="soon"
            title="Citation graph"
            pitch="See every rule a statute spawned, and every statute a rule traces back to. Walk the law like a map, not a phone book."
          />
          <ComingSoonCard
            icon={Scale}
            status="soon"
            title="Caselaw threading"
            pitch="Open a section and see the Supreme Court and circuit decisions that interpret it — with the holdings pulled out so you don't have to read 80 pages of opinion to find the one line that matters."
          />
          <ComingSoonCard
            icon={Calendar}
            status="vision"
            title="Deadline calculator"
            pitch="Tell us your situation — eviction notice, debt suit, agency complaint — and get the actual statutory deadlines counted out on a real calendar with the citations behind every date."
          />
          <ComingSoonCard
            icon={GraduationCap}
            status="vision"
            title="Pro se starter courses"
            pitch="Short, free walkthroughs of the procedures most people face alone — small claims, eviction defense, debt collection answers — built straight from the rules they cite."
          />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
