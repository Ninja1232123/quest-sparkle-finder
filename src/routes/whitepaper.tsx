import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { BookOpen, MapPin, Briefcase, Network, Database, Bell, Bot, GitCompare } from "lucide-react";

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
          not the ceiling. Here is where it goes — and why $5 a month is honest pricing for it.
        </p>

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
          </Section>

          <Section icon={Network} tag="research desk" title="The citation graph, made visible.">
            <p>
              A statute rarely stands alone. It gets defined in one place, modified in another, enforced
              by an agency rule somewhere else, and overridden by a court case nobody links to. The
              graph view makes those threads visible — click any section and see what cites it, what it
              cites, and what cites the things it cites.
            </p>
          </Section>

          <Section icon={Bell} tag="research desk" title="Alerts that actually mean something.">
            <p>
              Set a keyword, a section, or a topic. Get pinged when the underlying text changes,
              when new agency guidance lands, or when a freshly indexed document mentions it. No more
              checking the Federal Register on a Tuesday hoping you didn't miss something.
            </p>
          </Section>

          <Section icon={GitCompare} tag="research desk" title="Cases, notes, and exports.">
            <p>
              Save citations into private Case folders. Highlight and annotate sections in your own
              words. Export a clean PDF that includes the source text and your notes side by side —
              ready to walk into a courtroom, a hearing, or just a phone call with someone who insists
              you're wrong.
            </p>
          </Section>

          <Section icon={Database} tag="under the hood" title="A structured legal corpus, not another scraper.">
            <p>
              Behind the search bar is a normalized, de-duplicated, version-tracked corpus of every
              source on the shelf. Same schema across federal, state, and agency text. That's not a UI
              feature — it's the thing that makes everything else possible, and the thing that gives
              the data genuine value beyond the app itself.
            </p>
          </Section>

          <Section icon={Bot} tag="future" title="Optional AI, with the source always on screen.">
            <p>
              When AI shows up here, it shows up as a research assistant, not an oracle. Every answer
              comes attached to the actual statute or regulation it's reading from, and you can see the
              source text without leaving the page. If the model can't ground its answer in something
              on the shelf, it doesn't get to answer.
            </p>
          </Section>
        </div>

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
