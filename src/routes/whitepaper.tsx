import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import {
  BookOpen,
  MapPin,
  Briefcase,
  Network,
  Database,
  Bell,
  Bot,
  GitCompare,
  Scale,
  Gavel,
  FileSignature,
  Languages,
  Users,
  Mic,
  Map,
  ShieldCheck,
  Library,
  Sparkles,
  Calendar,
  Radio,
  GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/whitepaper")({
  component: Whitepaper,
  head: () => ({
    meta: [
      { title: "The Plan · Marginalia" },
      {
        name: "description",
        content:
          "Where Marginalia is going: state codebooks, domain packs, citation graphs, alerts, and a structured legal corpus built for actual humans.",
      },
      { property: "og:title", content: "The Plan · Marginalia" },
      {
        property: "og:description",
        content:
          "Where Marginalia is going: state codebooks, domain packs, citation graphs, alerts, and a structured legal corpus built for actual humans.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://self-law.org/whitepaper" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/whitepaper" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "The Plan · Marginalia",
          description:
            "The roadmap for Marginalia: state codebooks, domain packs, citation graphs, and a structured legal corpus.",
          author: { "@type": "Organization", name: "Marginalia" },
          publisher: { "@type": "Organization", name: "Marginalia" },
          mainEntityOfPage: "https://self-law.org/whitepaper",
        }),
      },
    ],
  }),
});

function Section({ icon: Icon, tag, title, children }: { icon: any; tag: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 py-10 first:border-t-0 first:pt-0">
      <div className="citation-tag flex items-center gap-2 text-sage-deep">
        <Icon className="h-3.5 w-3.5" />
        {tag}
      </div>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <div className="mt-4 space-y-3 text-foreground/75 leading-relaxed">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: "live" | "building" | "soon" | "vision" }) {
  const map = {
    live: { label: "Shipped", cls: "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400" },
    building: { label: "In build", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    soon: { label: "Coming soon", cls: "border-sage-deep/40 bg-sage-deep/10 text-sage-deep" },
    vision: { label: "On the horizon", cls: "border-terracotta/40 bg-terracotta/10 text-terracotta" },
  } as const;
  const v = map[status];
  return (
    <span className={`citation-tag rounded-full border px-2 py-0.5 ${v.cls}`}>{v.label}</span>
  );
}

function VisionCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: any;
  title: string;
  status: "live" | "building" | "soon" | "vision";
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60">
          <Icon className="h-4 w-4 text-sage-deep" />
        </div>
        <StatusBadge status={status} />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{children}</p>
    </div>
  );
}

function Milestone({ when, title, children, status }: { when: string; title: string; status: "live" | "building" | "soon" | "vision"; children: React.ReactNode }) {
  return (
    <li className="relative pl-8">
      <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-sage-deep bg-background">
        <span className="h-1.5 w-1.5 rounded-full bg-sage-deep" />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="citation-tag text-muted-foreground">{when}</span>
        <StatusBadge status={status} />
      </div>
      <h4 className="mt-1 font-display text-xl font-semibold tracking-tight">{title}</h4>
      <p className="mt-1 text-sm text-foreground/70 leading-relaxed">{children}</p>
    </li>
  );
}

function Whitepaper() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <div className="citation-tag text-muted-foreground">vol. I · the plan</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          A citizen's index of the law — built the way a citizen would actually use it.
        </h1>
        <p className="mt-6 text-lg text-foreground/70">
          Marginalia today is six federal codebooks indexed together: the Constitution, the U.S. Code, the
          CFR, the UCC, the Treasury Financial Manual, and the Internal Revenue Manual. That's the floor,
          not the ceiling. What follows is the full vision — what's shipped, what's being built right now,
          and the bigger swings on the horizon. Some of it is live. Most of it isn't yet. All of it is on
          the table.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status="live" />
          <StatusBadge status="building" />
          <StatusBadge status="soon" />
          <StatusBadge status="vision" />
          <span className="text-muted-foreground">— how to read this document.</span>
        </div>

        <div className="mt-12">
          <Section icon={BookOpen} tag="today" title="Federal floor: six books, one search.">
            <p>
              Every word of the federal codebooks is indexed, cross-linked, and searchable from a single
              bar. No paraphrase, no AI summary swapped in for the source. You read the law itself, with
              one click back to the official text it came from.
            </p>
            <p>
              Compare Mode puts the same term in split panes across multiple books at once. That alone
              replaces the usual loop of: search, open tab, ctrl-F, give up, ask Reddit.
            </p>
            <div className="mt-2"><StatusBadge status="live" /></div>
          </Section>

          <Section icon={MapPin} tag="next · state law" title="All 50 states, same shelf.">
            <p>
              Federal law is the floor. State statutes and administrative codes are where most people
              actually get tangled — landlord-tenant, traffic, family, small claims, tax. Each state's
              code becomes another book on the same shelf, with the same search, same compare, same
              annotation tools.
            </p>
            <p>
              Pinned to your account: pick the states you actually live and work in, and they get top
              billing in every search.
            </p>
            <div className="mt-2"><StatusBadge status="building" /></div>
          </Section>

          <Section icon={Briefcase} tag="next · domain packs" title="Specialized lanes for the real questions.">
            <p>
              Most people don't search "the law." They search a situation: an eviction notice, a
              wage-theft complaint, a denied tax refund, a debt collector who won't stop calling. Domain
              packs bundle the relevant federal statutes, regulations, agency guidance, and state
              equivalents into a single curated reading list — with the citations pre-threaded.
            </p>
            <p>
              Planned packs: tenant rights, consumer credit & debt, wage and hour, traffic & criminal
              procedure, small business formation, tax controversy, family court basics. More based on
              what people actually open.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={Network} tag="research desk" title="The citation graph, made visible.">
            <p>
              A statute rarely stands alone. It gets defined in one place, modified in another, enforced
              by an agency rule somewhere else, and overridden by a court case nobody links to. The
              graph view makes those threads visible — click any section and see what cites it, what it
              cites, and what cites the things it cites.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={Bell} tag="research desk" title="Alerts that actually mean something.">
            <p>
              Set a keyword, a section, or a topic. Get pinged when the underlying text changes,
              when new agency guidance lands, or when a freshly indexed document mentions it. No more
              checking the Federal Register on a Tuesday hoping you didn't miss something.
            </p>
            <div className="mt-2"><StatusBadge status="soon" /></div>
          </Section>

          <Section icon={GitCompare} tag="research desk" title="Cases, notes, and exports.">
            <p>
              Save citations into private Case folders. Highlight and annotate sections in your own
              words. Export a clean PDF that includes the source text and your notes side by side —
              ready to walk into a courtroom, a hearing, or just a phone call with someone who insists
              you're wrong.
            </p>
            <div className="mt-2"><StatusBadge status="building" /></div>
          </Section>

          <Section icon={Database} tag="under the hood" title="A structured legal corpus, not another scraper.">
            <p>
              Behind the search bar is a normalized, de-duplicated, version-tracked corpus of every
              source on the shelf. Same schema across federal, state, and agency text. That's not a UI
              feature — it's the thing that makes everything else possible, and the thing that gives
              the data genuine value beyond the app itself.
            </p>
            <div className="mt-2"><StatusBadge status="live" /></div>
          </Section>

          <Section icon={Bot} tag="future" title="Optional AI, with the source always on screen.">
            <p>
              When AI shows up here, it shows up as a research assistant, not an oracle. Every answer
              comes attached to the actual statute or regulation it's reading from, and you can see the
              source text without leaving the page. If the model can't ground its answer in something
              on the shelf, it doesn't get to answer.
            </p>
            <div className="mt-2"><StatusBadge status="vision" /></div>
          </Section>
        </div>

        {/* The bigger swings */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-terracotta">vol. II · the bigger swings</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Things that don't exist yet — but should.
          </h2>
          <p className="mt-4 max-w-2xl text-foreground/70 leading-relaxed">
            None of what follows is shipped. Some of it is queued, some is sketched on the back of a
            napkin, some is still an argument we're having with ourselves. We're putting it on the page
            because the point of Marginalia is to be the thing it's pointing at — and the only honest way
            to build that is in public.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <VisionCard icon={Gavel} title="Caselaw, threaded into the statutes" status="vision">
              Every section of the U.S. Code annotated with the federal cases that have actually
              interpreted it. Click a paragraph, see how courts read it — circuit splits and all.
            </VisionCard>
            <VisionCard icon={FileSignature} title="Form library with smart fill" status="soon">
              Court forms, agency complaints, FOIA letters, fee waivers — pre-wired to the statute that
              authorizes them. Fill once, file anywhere it applies.
            </VisionCard>
            <VisionCard icon={Languages} title="Plain-English layer (toggleable)" status="vision">
              A second pane that translates legalese into normal sentences, side by side with the
              original. The original never moves. The translation is always labeled as a translation.
            </VisionCard>
            <VisionCard icon={Map} title="Procedural maps for every domain" status="soon">
              "Here's the eviction process in your state, step by step, with the statute behind each
              step and the deadline next to it." A map, not a wall of text.
            </VisionCard>
            <VisionCard icon={Calendar} title="Deadline calculator" status="soon">
              Drop in a court date, a notice date, an agency response — get back every statutory
              deadline that hangs off it, with citations. Adds to your calendar.
            </VisionCard>
            <VisionCard icon={Scale} title="Local rules + court-specific procedure" status="vision">
              Federal district rules, state trial court rules, even individual judges' standing orders.
              The stuff that gets cases dismissed and nobody warns you about.
            </VisionCard>
            <VisionCard icon={Users} title="Public Cases (opt-in)" status="vision">
              Make a Case folder public. Other people facing the same situation see your reading list,
              your annotations, your filings — fully attributed, fully optional.
            </VisionCard>
            <VisionCard icon={ShieldCheck} title="Rights-at-a-glance cards" status="building">
              Pulled-over, knock-and-talk, ICE at the door, school search, traffic stop. One card per
              situation, every claim backed to a statute or a controlling case.
            </VisionCard>
            <VisionCard icon={Mic} title="Read-aloud + audio briefs" status="vision">
              Long agency manuals turned into clean audio you can listen to on the bus. Same source
              text, just a different way in.
            </VisionCard>
            <VisionCard icon={Library} title="Historical versions, side by side" status="soon">
              Pick a date, see the law as it stood that day. Compare two versions of the same section
              with a single click. Useful for cases, essential for journalism.
            </VisionCard>
            <VisionCard icon={GraduationCap} title="Pro se starter courses" status="vision">
              Short, free, branching courses that walk you from "I just got served" to "I filed a
              response." Built around the actual statutes, not generic advice.
            </VisionCard>
            <VisionCard icon={Radio} title="Federal Register, demystified" status="soon">
              The daily firehose of new rules, sliced by agency and topic, with diffs against the
              existing CFR. Subscribe to a slice, get a weekly digest.
            </VisionCard>
          </div>

          <p className="mt-8 text-sm text-foreground/60 italic">
            None of these are promises. They're the shape of the thing we're trying to build. If one of
            them sounds like the reason you'd actually use Marginalia, tell us — that's how the next
            quarter gets prioritized.
          </p>
        </section>

        {/* Roadmap timeline */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-sage-deep">vol. III · the order of operations</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Roughly when, roughly in what order.
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/70">
            Dates are honest estimates, not commitments. Things move when the corpus, the funding, and
            reality all line up.
          </p>

          <ol className="mt-10 space-y-8 border-l border-border/70 pl-2">
            <Milestone when="now" status="live" title="Federal six on one shelf">
              Constitution, USC, CFR, UCC, TFM, IRM — searchable, cross-linked, and free to read.
            </Milestone>
            <Milestone when="this quarter" status="building" title="Cases, notes & exports v1">
              Save citations into private Case folders, annotate sections, export clean PDFs that hold
              up at a hearing.
            </Milestone>
            <Milestone when="next quarter" status="soon" title="First five state codes">
              California, Texas, New York, Florida, Illinois — same schema, same search, pinned to your
              account.
            </Milestone>
            <Milestone when="next quarter" status="soon" title="Domain packs (tenant, debt, wage)">
              The first three curated reading lists, with procedural maps and deadline calculators
              wired in.
            </Milestone>
            <Milestone when="later this year" status="soon" title="Citation graph + alerts">
              Visual graph view across the corpus. Subscribe to a section or a keyword, get pinged when
              it changes.
            </Milestone>
            <Milestone when="later this year" status="vision" title="Caselaw threading">
              Federal opinions threaded into the statutes they interpret. Starts with the most-cited
              sections and works outward.
            </Milestone>
            <Milestone when="next year" status="vision" title="All 50 states, plain-English layer, AI assistant">
              The shelf gets full, the translation pane goes live, and the source-grounded research
              assistant opens for Pro accounts.
            </Milestone>
          </ol>
        </section>

        {/* Principles */}
        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="citation-tag text-muted-foreground">vol. IV · the rules we won't break</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            How we'd rather lose than win.
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <Sparkles className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">Reading the law stays free.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                Forever. The source is public; the index of it should be too. Pro pays for the desk
                around it.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <BookOpen className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">The source is always on screen.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                No summary replaces the statute. Translations and AI answers ride alongside the
                original — they don't replace it.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <ShieldCheck className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">No legal advice, ever.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                We index the law. We don't tell you what to do with it. That line is the whole reason
                this can exist.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <Database className="h-4 w-4 text-sage-deep" />
              <h3 className="mt-2 font-display text-lg font-semibold">Open exports, always.</h3>
              <p className="mt-1 text-sm text-foreground/70">
                Your Cases, notes, and citations leave with you in plain formats. No lock-in is part of
                the product.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-16 rounded-3xl border border-sage-deep/30 bg-sage-deep/5 p-8 text-center">
          <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">why $5</p>
          <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Five bucks a month is the honest number.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-foreground/70">
            Reading the law stays free. Pro covers the work that scales: ingesting state codes, keeping
            agency manuals current, the citation graph, alerts, exports, the whole research desk. Every
            $5 funds another piece. No trial, no bait, no upsell ladder.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/subscribe"
              className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Go Pro — $5/mo
            </Link>
            <Link
              to="/code"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Or just read the law
            </Link>
          </div>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
