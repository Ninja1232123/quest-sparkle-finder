import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { SearchBar } from "@/components/marginalia/SearchBar";
import { listSources } from "@/lib/documents.functions";
import { codebookForSource } from "@/lib/codebooks";
import { sourceMeta } from "@/lib/source-groups";
import { Analytics } from "@vercel/analytics/next"

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
      { title: "Self-Law - A Legal Research Tool For Pro Se Litigants" },
      {
        name: "description",
        content:
          "Search primary law across all 50 states. Save marginalia notes directly to your case file, use our legal template builder, and compare statutes side by side.",
      },
      { property: "og:title", content: "Self-Law — A citizen's law index" },
      {
        property: "og:description",
        content:
          "Search primary law across all 50 states. Save marginalia notes directly to your case file, use our legal template builder, and compare statutes side by side.",
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
        {/* EAGLE HERO — navy bg, spinning gold foil disc, screaming eagle */}
        <section className="home-hero-am">
          <div className="hh-foil" />
          <div className="hh-rays" />

          {/* Flanking law quotes — fill the navy on either side of the eagle.
              Each side is a vertical rail: the quote up top, plus an extra
              editable note slot below it for informative updates. */}
          <div className="hero-rail hero-rail-l">
            <blockquote className="hero-quote">
              <p>Not legal advice, A legal tool.</p>
              <cite></cite>
            </blockquote>
            {/* EDITABLE SLOT — left, below the quote. Change this text freely. */}
            <div className="hero-note">
              <p>BEST SERVED ON A DESKTOP. MOBILE APP COMING SOON!</p>
            </div>
          </div>

          <div className="hero-rail hero-rail-r">
            <blockquote className="hero-quote">
              <p>Justice is a position you make. Not a position that just occurs. </p>
              <cite></cite>
            </blockquote>
            {/* EDITABLE SLOT — right, below the quote. Change this text freely. */}
            <div className="hero-note">
              <p>NEW:Legal template document builder in the Tools tab.</p>
            </div>
          </div>

          <img
            className="home-eagle-img"
            src="/bald-eagle.png"
            alt="Screaming bald eagle, wings spread — Land of the Free"
          />

          {/* The punchline */}
          <div className="hero-pitch">
            <span className="hero-pitch-line"></span>
            <span className="hero-pitch-amt">You were born to argue.</span>
          </div>

          <div className="home-hero-foot" />
        </section>

        {/* CONSTITUTION CARTOUCHE — overlaps eagle from below, flanked by update slots */}
        <div className="home-const-row">
          {/* LEFT update slot — edit freely to announce features/news */}
          <div className="home-const-aside home-const-aside-l">
            <p className="hca-label">New</p>
            <p className="hca-body">
              Court record reader: open any federal opinion on Self-Law and ask
              Juri about the holding — without leaving the page.
            </p>
            <div className="hca-divider" />
            <p className="hca-body">
              Cases panel now appears on every statute section, ranked by how
              often courts have cited it.
            </p>
          </div>

          {/* CENTER — the main cartouche */}
          <div className="home-const-wrap">
            <Link to="/how-it-works" className="home-const-cartouche">
              <div className="hcc-wtp">Read the law yourself.</div>
              <div className="hcc-kicker">How this tool works</div>
              <h2>Search every U.S. law at once</h2>
              <div className="hcc-sub">
                Hey Thanks for checking us out! Best serveed on a PC or laptop right now. Mobile app coming soon! .
              </div>
              <div className="hcc-pills">
                <span className="hcc-pill">Search every source</span>
                <span className="hcc-pill">Browse by structure</span>
                <span className="hcc-pill">Compare side-by-side</span>
                <span className="hcc-pill">Real source text</span>
              </div>
              <div className="hcc-cta">See everything it does →</div>
            </Link>
          </div>

          {/* RIGHT update slot — edit freely to announce features/news */}
          <div className="home-const-aside home-const-aside-r">
            <p className="hca-label">NEW</p>
            <p className="hca-body">
              Subscribers can purchase credits to use Juri, the AI model connected to our database —
              Deep search through court cases and statutes.
            </p>
            <div className="hca-divider" />
            <p className="hca-body">
              Legal document template document builder is live in the Tools tab.
            </p>
          </div>
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
                <span className="dot" />Direct from official sources
              </span>
              <span className="cite-tag">{totalDocs.toLocaleString()} documents indexed</span>
            </div>
            <div className="text-center mt-4">
              <Link to="/how-it-works" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                New here? See how it works →
              </Link>
            </div>
          </div>
        </section>

        {/* ALL CODEBOOKS — below "We the People", parchment bg */}
        <section className="home-codebook-shelf">
          <div className="mx-auto max-w-7xl">
            <div className="home-am-grid">
              {/* Federal / non-state sources as individual cards. The 50 states
                  collapse into one aggregate card (below) so they don't flood
                  the shelf — same treatment as the Browse landing. */}
              {sources
                .filter((s: SourceRow) => s.code !== "const" && sourceMeta(s.code).group !== "state")
                .map((s: SourceRow) => {
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

              {/* All 50 states, collapsed into one card → /states */}
              {(() => {
                const stateSources = sources.filter((s: SourceRow) => sourceMeta(s.code).group === "state");
                if (stateSources.length === 0) return null;
                const total = stateSources.reduce((n: number, s: SourceRow) => n + s.count, 0);
                return (
                  <Link to="/states" className="am-card" style={{ ["--c" as never]: "#4a6741" }}>
                    <div className="am-num">50</div>
                    <div className="am-title">All 50 States</div>
                    <div className="am-meta">
                      <span className="am-count">{total.toLocaleString()} sections</span>
                      <span className="am-go">Browse →</span>
                    </div>
                  </Link>
                );
              })()}

              {/* Court outcomes — the analytics layer: how cases actually end */}
              <Link to="/outcomes" className="am-card" style={{ ["--c" as never]: "#9b3722" }}>
                <div className="am-num">%</div>
                <div className="am-title">Court Outcomes</div>
                <div className="am-meta">
                  <span className="am-count">Federal base rates</span>
                  <span className="am-go">Explore →</span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
