import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { CODEBOOKS } from "@/lib/codebooks";
import {
  Search as SearchIcon,
  Columns,
  BookOpen,
  PencilLine,
  MessagesSquare,
  Sparkles,
  GitCompareArrows,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  component: Features,
  head: () => ({
    meta: [
      { title: "What it does · Marginalia" },
      {
        name: "description",
        content:
          "A plain-English tour of everything Marginalia does: read the actual law, search it, compare sources side by side, take margin notes, and ask Juri.",
      },
      { property: "og:title", content: "What it does · Marginalia" },
      {
        property: "og:description",
        content: "Read the law, search it, compare it, annotate it, and ask questions about it — in one place, for $5.",
      },
    ],
  }),
});

/* The tools/features on the desk — only things that actually ship today.
   Honest by design: anything still on the workbench lives in "What's next". */
type Feature = {
  icon: LucideIcon;
  name: string;
  href: string;
  what: string;        // the one-liner: what it does
  detail: string;      // a sentence of how / why it's useful
  accent: string;
};

const FEATURES: Feature[] = [
  {
    icon: SearchIcon,
    name: "Search",
    href: "/search",
    what: "Find a phrase across every book at once.",
    detail:
      "Type a term, a citation, or a whole phrase and it hits the Constitution, the U.S. Code, the CFR, agency manuals and the rest in one pass — no picking a database first.",
    accent: "#0a1f44",
  },
  {
    icon: Columns,
    name: "Compare",
    href: "/compare",
    what: "Put the same idea from different sources side by side.",
    detail:
      "Set one phrase against multiple codebooks in parallel columns, expand the matches inline, and pin the ones worth keeping to a shelf so you can read them together.",
    accent: "#1a4a2e",
  },
  {
    icon: GitCompareArrows,
    name: "Diff",
    href: "/compare/diff",
    what: "See exactly what changed between two passages, word for word.",
    detail:
      "A true word-level diff for when two sections almost say the same thing — the wording that differs is what usually matters.",
    accent: "#5b3a8a",
  },
  {
    icon: BookOpen,
    name: "The reader",
    href: "/usc",
    what: "Read the law the way it was meant to be read — in context.",
    detail:
      "Every section opens in a clean, single-column reader with a breadcrumb up the hierarchy (title → chapter → section), numbered clauses, and a per-book color so you always know which body of law you're standing in.",
    accent: "#b22234",
  },
  {
    icon: PencilLine,
    name: "Margin notes",
    href: "/usc",
    what: "Jot your own notes in the margin as you read.",
    detail:
      "Like writing in the margin of a paper book — your notes sit beside the text in their own column, so a growing note never shoves the law around.",
    accent: "#c45a2c",
  },
  {
    icon: Sparkles,
    name: "Juri",
    href: "/usc",
    what: "Ask the eagle what a passage means — and have it help you draft.",
    detail:
      "A research assistant that lives in the corner of the page. Juri is a drafting and explaining tool, not a lawyer — it helps you understand and write, and always points you back to the source.",
    accent: "#8b4513",
  },
  {
    icon: MessagesSquare,
    name: "The Floor",
    href: "/forum",
    what: "Compare notes with other people reading the same law.",
    detail:
      "An open forum to ask what something means, share what you found, and argue it out — because you were born to argue.",
    accent: "#3d3d5c",
  },
];

function Features() {
  const live = CODEBOOKS.filter((c) => c.status === "live");
  const soon = CODEBOOKS.filter((c) => c.status === "soon");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-10">
          <div className="citation-tag text-accent">the short version</div>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
            What Marginalia <span className="ink-underline italic">actually does</span>.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-foreground/85">
            It puts the primary law — the real, written rules — in one place, and gives you a handful of
            plain tools to read it, search it, line it up against itself, and make sense of it. No
            theories, no spin. Just the law and a good desk to read it at.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className="btn-ink">Start at the index →</Link>
            <Link to="/whitepaper" className="btn-paper">Read the whitepaper →</Link>
          </div>
        </section>

        {/* ── The Library ──────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="citation-tag text-sage-deep">① the books on the shelf</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Read the actual law.
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/75 leading-relaxed">
            These are the bodies of law indexed today — the same public-domain primary sources the
            expensive services charge a fortune for. Click any one to start browsing.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((cb) => (
              <Link
                key={cb.slug}
                to={`/${cb.slug}` as never}
                className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)]"
                style={{ ["--c" as never]: cb.accent }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${cb.accent}1a` }}>
                    <cb.icon className="h-4 w-4" style={{ color: cb.accent }} />
                  </span>
                  <div className="font-display text-base font-semibold leading-tight">{cb.name}</div>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-foreground/65">{cb.tagline}</p>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wider opacity-70 group-hover:opacity-100" style={{ color: cb.accent }}>
                  Browse →
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── The Tools ────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="citation-tag text-accent">② tools on the desk</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Then do something with it.
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/75 leading-relaxed">
            Reading is half of it. Here's everything you can do with the text once it's in front of you.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <Link
                key={f.name}
                to={f.href as never}
                className="group flex gap-4 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)]"
                style={{ ["--c" as never]: f.accent }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${f.accent}1a` }}>
                  <f.icon className="h-5 w-5" style={{ color: f.accent }} />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold leading-tight">{f.name}</div>
                  <div className="mt-0.5 text-sm font-medium text-foreground/90">{f.what}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/60">{f.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── What's next ──────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="citation-tag text-terracotta">③ on the workbench</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            What's coming next.
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/75 leading-relaxed">
            Being honest about what isn't here yet. These are in progress, not promises in a brochure.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((cb) => (
              <div
                key={cb.slug}
                className="rounded-2xl border border-dashed border-border bg-muted/30 p-5"
                style={{ ["--c" as never]: cb.accent }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${cb.accent}14` }}>
                    <cb.icon className="h-4 w-4" style={{ color: cb.accent }} />
                  </span>
                  <div className="font-display text-base font-semibold leading-tight">{cb.name}</div>
                  <span className="ml-auto rounded-full border border-ochre/40 bg-ochre/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ochre">
                    soon
                  </span>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-foreground/60">{cb.tagline}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
              <div className="font-display text-base font-semibold leading-tight">A visible citation graph</div>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/60">
                See what cites what — follow a section out to every place it's referenced, and trace
                where a rule comes from.
              </p>
            </div>
          </div>
        </section>

        {/* ── Pricing strip ────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-3xl border-2 border-accent/40 bg-accent/5 p-8 text-center">
            <div className="citation-tag text-accent">the honest number</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Reading the law is free. <span className="ink-underline italic">Forever.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-foreground/75 leading-relaxed">
              Browsing, searching, comparing, and reading never cost a thing. Pro is $5/month — it funds
              the next book on the shelf (all 50 state codes are next) and unlocks the heavier tools.
              That's it. Westlaw charges about $1,300.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/subscribe" className="btn-ink">Go Pro · $5/mo →</Link>
              <Link to="/about" className="btn-paper">Why it exists →</Link>
            </div>
          </div>
          <p className="mt-6 text-center text-xs italic text-muted-foreground">
            A research desk, not legal advice. Always read the cited source before you rely on a summary.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
