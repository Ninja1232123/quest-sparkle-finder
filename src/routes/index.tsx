import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { listSources } from "@/lib/documents.functions";
import { codebookForSource } from "@/lib/codebooks";
import { Marginalia } from "@/components/marginalia/Marginalia";
import { HOME_NOTES } from "@/components/marginalia/marginalia-home-notes";

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
const TRY_TERMS = ["due process", "right to cure", "15 USC 1692", "4th amendment", "commercial paper"];

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

      <main className="relative">
        <Marginalia notes={HOME_NOTES} />
        {/* EAGLE HERO — navy bg, spinning gold foil disc, screaming eagle */}
        <section className="home-hero-am">
          <div className="hh-foil" />
          <div className="hh-rays" />

          {/* Flanking law quotes — fill the navy on either side of the eagle */}
          <blockquote className="hero-quote hero-quote-l">
            <p>Not legal advice, A legal tool.</p>
            <cite>Hi I'm a tool. 9</cite>
          </blockquote>
          <blockquote className="hero-quote hero-quote-r">
            <p>Don't forget who really makes the rules.</p>
            <cite>The law stops working when it's illogical.</cite>
          </blockquote>

          <img
            className="home-eagle-img"
            src="/bald-eagle.png"
            alt="Screaming bald eagle, wings spread — Land of the Free"
          />

          {/* The punchline */}
          <div className="hero-pitch">
            <span className="hero-pitch-line">The law is now</span>
            <span className="hero-pitch-amt"></span>
          </div>

          <div className="home-hero-foot" />
        </section>

        {/* CONSTITUTION CARTOUCHE — overlaps eagle from below */}
        <div className="home-const-wrap">
          <Link to="/const" className="home-const-cartouche">
            <div className="hcc-wtp">We the People</div>
            <div className="hcc-kicker">Of the United States of America</div>
            <h2>The Constitution</h2>
            <div className="hcc-sub">
              Seven articles. Twenty-seven amendments. One stubborn experiment in self-rule — the law all other law answers to.
            </div>
            <div className="hcc-pills">
              <span className="hcc-pill">7 Articles</span>
              <span className="hcc-pill red">27 Amendments</span>
              <span className="hcc-pill">founding charter</span>
            </div>
            <div className="hcc-cta">★ Read the Whole Thing →</div>
          </Link>
        </div>

        {/* "LAND OF THE FREE" RIBBON */}
        <div className="home-am-ribbon">
          Land of the Free <span className="star">★</span> Home of the Brave
        </div>

        {/* SEARCH */}
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="text-center mb-6">
            <div className="home-hero-eyebrow">Vol. I · the citizen's index</div>
            <h1 className="hero-h1" style={{ fontSize: "clamp(32px, 4vw, 60px)", margin: "0 0 14px" }}>
              Marginalia —&nbsp;<span className="ink-underline italic">a citizen's law index.</span>
            </h1>
            <p className="home-hero-sub" style={{ maxWidth: 560, margin: "0 auto 24px" }}>
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

        {/* ALL CODEBOOKS — below "We the People", parchment bg */}
        <section className="home-codebook-shelf">
          <div className="mx-auto max-w-7xl">
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
      </main>

      <SiteFooter />
    </div>
  );
}
