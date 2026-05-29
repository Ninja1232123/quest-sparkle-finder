import { createFileRoute, Link } from "@tanstack/react-router";
import { TOPICS } from "@/data/topics";
import { TopicCard } from "@/components/marginalia/TopicCard";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { listSources } from "@/lib/documents.functions";
import { codebookForSource } from "@/lib/codebooks";
import {
  GitCompare, Highlighter, FileDown, Bell, Zap, Folder, Network,
  Map, Brain, Scale, Calendar, GraduationCap, ArrowRight,
} from "lucide-react";

// Full names (cards) and short codes (hero chips), keyed by source code.
const SOURCE_LABELS: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
};
const SOURCE_SHORT: Record<string, string> = {
  const: "Const.", usc: "U.S. Code", cfr: "CFR", ucc: "UCC", tfm: "TFM", irm: "IRM",
};
const SOURCE_TAGLINE: Record<string, string> = {
  const: "founding charter",
  usc: "statutory law",
  cfr: "agency rules",
  ucc: "commercial code",
  tfm: "treasury manual",
  irm: "irs manual",
};

const TRY_TERMS = ["due process", "right to cure", "15 USC 1692", "4th amendment", "commercial paper"];

const METHOD_STEPS = [
  { n: "I.", h: "Read primary sources", p: "No paraphrase replaces the original. Every result links back to the actual statute, regulation, or agency manual it came from." },
  { n: "II.", h: "Trace the connections", p: "A statute rarely stands alone. The citation graph shows how rules across agencies cross-reference and depend on each other." },
  { n: "III.", h: "Build your case", p: "Save citations into private Case folders. Annotate with your own notes. Export to PDF. Your research, organized." },
];

const PRO_FEATURES = [
  { icon: GitCompare, label: "Side-by-side compare" },
  { icon: Highlighter, label: "Highlight & annotate" },
  { icon: FileDown, label: "Export to PDF" },
  { icon: Bell, label: "Keyword alerts" },
  { icon: Folder, label: "Unlimited Cases" },
  { icon: Network, label: "Citation graph" },
];

const NEXT_ROOMS = [
  { icon: Map, status: "building", title: "All 50 states, indexed", pitch: "Every state code, every state constitution, every state regulation — rolled into the same search bar." },
  { icon: Brain, status: "building", title: "Plain-English mode", pitch: "A toggle that translates any statute into everyday language, side-by-side with the original." },
  { icon: Network, status: "soon", title: "Citation graph", pitch: "See every rule a statute spawned. Walk the law like a map, not a phone book." },
  { icon: Scale, status: "soon", title: "Caselaw threading", pitch: "Open a section and see the decisions that interpret it — with the holdings pulled out so you don't read 80 pages to find the one line that matters." },
  { icon: Calendar, status: "vision", title: "Deadline calculator", pitch: "Tell us your situation and get the statutory deadlines counted out on a real calendar, with the citation behind every date." },
  { icon: GraduationCap, status: "vision", title: "Pro se starter courses", pitch: "Short, free walkthroughs of the procedures most people face alone — built straight from the rules they cite." },
];

// Per-source accent — falls back to ink. Pulls from the codebooks registry so
// colors stay consistent with the header tab strip and codebook landings.
function accentForSource(code: string): string {
  return codebookForSource(code)?.accent ?? "var(--ink)";
}

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

type SourceRow = { code: string; name: string; count: number };

function Index() {
  const { sources } = Route.useLoaderData();
  const totalDocs = sources.reduce((n: number, s: { count: number }) => n + s.count, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* EAGLE HERO */}
        <section className="home-hero-am">
          <div className="hh-rays" />
          <img
            className="home-eagle-img"
            src="/bald-eagle.png"
            alt="Screaming bald eagle, wings spread — Land of the Free"
          />
          <div className="home-hero-foot" />
        </section>

        {/* "LAND OF THE FREE" RIBBON */}
        <div className="home-am-ribbon">
          Land of the Free <span className="star">★</span> Home of the Brave
        </div>

        {/* SEARCH */}
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="text-center mb-6">
            <div className="eyebrow mb-2">Vol. I · the citizen's index</div>
            <h1 className="hero-h1" style={{ fontSize: "clamp(32px, 4vw, 60px)", margin: "0 0 14px" }}>
              Marginalia —&nbsp;<span className="ink-underline italic">a citizen's law index.</span>
            </h1>
            <p className="hero-sub" style={{ maxWidth: 560, margin: "0 auto 24px", fontSize: 20 }}>
              If you don't know your rights, you don't have any.
            </p>
          </div>
          <div className="mx-auto max-w-2xl">
            <SearchBar />
            <div className="try-row justify-center mt-3">
              <span className="cite-tag">try:</span>
              {TRY_TERMS.map((s) => (
                <Link key={s} to="/search" search={{ q: s, source: "" }} className="try-chip">
                  {s}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
              <span className="live-pill">
                <span className="dot" />✓ Updated May 2026 · direct from source
              </span>
              <span className="cite-tag">{totalDocs.toLocaleString()} documents indexed</span>
            </div>
          </div>
        </section>

        {/* CODEBOOKS — Constitution as centerpiece */}
        <section className="home-codebook-shelf">
          <div className="mx-auto max-w-7xl">
            <div className="home-shelf-head">
              <div>
                <div className="home-shelf-eyebrow">★ primary sources</div>
                <div className="home-shelf-h2">Open the Code.</div>
              </div>
              <span className="home-shelf-count">{sources.length} codebooks · {totalDocs.toLocaleString()} sections</span>
            </div>

            {/* Constitution featured — gold border, center of attention */}
            <Link to="/const" className="const-hero-card block mb-4">
              <div className="chc-eyebrow">★ the foundation of american law ★</div>
              <h3>The Constitution</h3>
              <div className="chc-sub">Seven articles. Twenty-seven amendments. One stubborn experiment in self-rule — the law all other law answers to.</div>
              <div className="chc-pills">
                <span className="chc-pill">7 Articles</span>
                <span className="chc-pill red">27 Amendments</span>
                <span className="chc-pill">founding charter</span>
              </div>
              <div className="chc-cta">★ Read the whole thing →</div>
            </Link>

            {/* All other codebooks — Americana pill cards */}
            <div className="home-am-grid">
              {sources.filter((s: SourceRow) => s.code !== "const").map((s: SourceRow) => {
                const accent = accentForSource(s.code);
                return (
                  <Link
                    key={s.code}
                    to="/code/source/$source"
                    params={{ source: s.code }}
                    className="am-card"
                    style={{ ["--c" as never]: accent }}
                  >
                    <div className="am-num">{SOURCE_SHORT[s.code] ?? s.code.toUpperCase()}</div>
                    <div className="am-title">{SOURCE_LABELS[s.code] ?? s.name}</div>
                    <div className="am-meta">
                      <span className="am-count">{s.count.toLocaleString()} sections</span>
                      <span className="am-go">Browse →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* METHOD */}
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="section-title-bar">
            <div>
              <div className="eyebrow">the method</div>
              <h2 className="sec-h2">How Marginalia works.</h2>
            </div>
            <Link to="/about" className="btn-paper">Read the whole story →</Link>
          </div>
          <div className="method-grid mt-8">
            {METHOD_STEPS.map((step) => (
              <div key={step.n} className="method-step">
                <span className="method-roman">{step.n}</span>
                <h3 className="method-h3">{step.h}</h3>
                <p className="method-p">{step.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CODEBOOKS — the centerpiece */}
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="section-title-bar">
            <div>
              <div className="eyebrow">primary sources</div>
              <h2 className="sec-h2">Open the <span className="ink-underline italic">Code</span>.</h2>
            </div>
            <Link to="/code" className="btn-ink">
              Browse all codebooks <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="codebook-grid mt-8">
            {sources.map((s: SourceRow) => {
              const accent = accentForSource(s.code);
              const Icon = codebookForSource(s.code)?.icon;
              return (
                <Link
                  key={s.code}
                  to="/code/source/$source"
                  params={{ source: s.code }}
                  className="cb-card-v2"
                  style={{ ["--c" as never]: accent }}
                >
                  <div className="cb-row">
                    {Icon ? <span className="cb-icon"><Icon /></span> : <span />}
                    <span className="count-pill" style={{ ["--c" as never]: accent }}>
                      <span className="num">{s.count.toLocaleString()}</span>
                      <span className="lbl">docs</span>
                    </span>
                  </div>
                  <div className="cb-name">{SOURCE_LABELS[s.code] ?? s.name}</div>
                  <div className="cb-foot">
                    <span>{SOURCE_TAGLINE[s.code] ?? "primary source"}</span>
                    <span className="arrow">Browse <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* PRO PANEL */}
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="pro-panel-v2">
            <div>
              <div className="eyebrow">Pro · the research desk</div>
              <h2>The full research desk.</h2>
              <p>
                Reading the law stays free. The power tools — Compare, annotate, export, alerts —
                are $5 a month. Less than a cup of coffee. More useful than a lawyer's first call.
              </p>
              <div className="pro-features-v2">
                {PRO_FEATURES.map(({ icon: Icon, label }) => (
                  <div key={label} className="pf">
                    <span className="ico"><Icon /></span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="price">
              <span className="per">Pro · cancel anytime</span>
              <span className="amt">$5<span style={{ fontSize: 18, marginLeft: 4, fontWeight: 600 }}>/mo</span></span>
              <span className="note">Every $5 funds the next book on the shelf.</span>
              <Link to="/subscribe" className="btn-ink go" style={{ justifyContent: "center", width: "100%" }}>
                <Zap className="h-4 w-4" />Go Pro · $5/mo
              </Link>
            </div>
          </div>
        </section>

        {/* TOPIC SAMPLERS */}
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="section-title-bar">
            <div>
              <div className="eyebrow">curated walkthroughs</div>
              <h2 className="sec-h2">Topic samplers.</h2>
            </div>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {TOPICS.map((t) => (
              <TopicCard key={t.slug} topic={t} />
            ))}
          </div>
        </section>

        {/* WHAT'S NEXT */}
        <section className="mx-auto max-w-7xl px-6 py-14 pb-24">
          <div className="section-title-bar">
            <div>
              <div className="eyebrow terracotta">vol. II · the build list</div>
              <h2 className="sec-h2">Rooms we haven't built yet.</h2>
            </div>
            <Link to="/whitepaper" className="btn-paper">Read the whitepaper →</Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NEXT_ROOMS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="cs-card">
                  <div className="cs-row">
                    <Icon className="cs-icon" />
                    <span className={`cs-status ${c.status}`}>{c.status}</span>
                  </div>
                  <div className="cs-title">{c.title}</div>
                  <p className="cs-pitch">{c.pitch}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
