import { createFileRoute, Link } from "@tanstack/react-router";
import { listSources, searchDocuments } from "@/server/documents.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useState } from "react";
import baldEagle from "@/assets/bald-eagle.png";

// Per-codebook 'merica backgrounds. Each source gets its own flavor.
const SOURCE_BG: Record<string, string> = {
  const:
    "bg-[linear-gradient(135deg,#0a1f44_0%,#0a1f44_40%,#b22234_40%,#b22234_55%,#f5f0e0_55%,#f5f0e0_70%,#b22234_70%,#b22234_85%,#0a1f44_85%)]",
  usc:
    "bg-[radial-gradient(circle_at_20%_30%,#fff_0,#fff_2px,transparent_3px),radial-gradient(circle_at_70%_60%,#fff_0,#fff_2px,transparent_3px),linear-gradient(180deg,#0a1f44,#1a3a6e)] [background-size:24px_24px,32px_32px,100%_100%]",
  cfr:
    "bg-[repeating-linear-gradient(0deg,#b22234_0_18px,#f5f0e0_18px_36px)]",
  ucc:
    "bg-[repeating-linear-gradient(45deg,#0a1f44_0_22px,#c9a84c_22px_28px,#b22234_28px_50px)]",
  tfm:
    "bg-[linear-gradient(135deg,#1a4a2e,#0a1f44_60%,#000)]",
  irm:
    "bg-[repeating-linear-gradient(90deg,#0a1f44_0_30px,#b22234_30px_36px,#f5f0e0_36px_42px)]",
};

const SOURCE_DESC: Record<string, { tagline: string; example: string }> = {
  const: { tagline: "The founding charter — articles & amendments.", example: "/us/const/amendment/1" },
  usc:   { tagline: "Federal statutory law, organized by title.", example: "/us/usc/t11/s101" },
  cfr:   { tagline: "Federal agency regulations — the rulebook that puts statutes into practice.", example: "/us/cfr/t29/s541.100" },
  ucc:   { tagline: "Model commercial law adopted by every state.", example: "/us/ucc/a2/s2-201" },
  tfm:   { tagline: "Treasury rules for federal financial operations.", example: "/us/tfm/v1/p1/c1000" },
  irm:   { tagline: "How the IRS internally administers the tax code.", example: "/us/irm/p1/c1/s1" },
};

export const Route = createFileRoute("/code/")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: CodeHub,
  head: () => ({
    meta: [
      { title: "The Code · Marginalia" },
      { name: "description", content: "Search the Constitution, U.S. Code, UCC, and Treasury Financial Manual side by side, with cross-references traced between them." },
      { property: "og:title", content: "The Code · Marginalia" },
      { property: "og:description", content: "Browse and search six federal codebooks indexed in one place." },
      { property: "og:url", content: "https://self-law.org/code" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/code" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "The Code · Marginalia",
          description:
            "Indexed federal codebooks: Constitution, U.S. Code, CFR, UCC, TFM, and IRM.",
          url: "https://self-law.org/code",
        }),
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load the index</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CodeHub() {
  const { sources } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string | undefined>(undefined);
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchDocuments>>["hits"]>([]);
  const [searching, setSearching] = useState(false);

  const totalDocs = sources.reduce((n: number, s: { count: number }) => n + s.count, 0);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    const res = await searchDocuments({ data: { q: q.trim(), source } });
    setHits(res.hits);
    setSearching(false);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative mx-auto max-w-5xl px-6 py-12">
        {/* Sick bald eagle, screaming silently behind the law */}
        <img
          src={baldEagle}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-8 right-0 -z-10 w-[520px] max-w-[80%] opacity-[0.18] mix-blend-multiply select-none"
        />
        <div className="citation-tag text-muted-foreground">primary sources</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          The <span className="ink-underline italic">Code</span>, in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          {totalDocs.toLocaleString()} documents across {sources.length} source{sources.length === 1 ? "" : "s"}.
          Citations between them are traced and clickable, even across sources.
        </p>

        <form onSubmit={onSearch} className="mt-8 flex flex-col gap-2 sm:flex-row">
          <select
            value={source ?? ""}
            onChange={(e) => setSource(e.target.value || undefined)}
            className="h-12 rounded-full border border-foreground/15 bg-background/90 px-4 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          >
            <option value="">All sources</option>
            {sources.map((s: { code: string; name: string }) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — e.g. 'establishment of religion', 'statute of frauds', 'oath'"
            className="h-12 flex-1 rounded-full border border-foreground/15 bg-background/90 px-5 font-display text-base shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          />
          <button
            type="submit"
            className="h-12 rounded-full border border-foreground/20 bg-foreground px-6 font-display text-sm text-background hover:opacity-90"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {hits.length > 0 && (
          <div className="mt-8">
            <div className="citation-tag text-accent">{hits.length} matches</div>
            <ul className="mt-3 space-y-3">
              {hits.map((h) => (
                <li key={h.identifier}>
                  <Link
                    to="/code/$"
                    params={{ _splat: h.identifier.replace(/^\//, "") }}
                    className="block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="citation-tag text-muted-foreground">
                      {h.parent_label ?? h.source_code.toUpperCase()}
                      {h.section_label ? ` · ${h.section_label}` : ""}
                    </div>
                    <div className="mt-1 font-display text-base font-semibold">{h.heading}</div>
                    <p className="mt-2 text-sm text-foreground/75">{h.snippet}…</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {sources.map((s: { code: string; name: string; count: number }) => {
            const desc = SOURCE_DESC[s.code] ?? { tagline: "Browse this source.", example: "" };
            const bg = SOURCE_BG[s.code] ?? "bg-card";
            return (
              <Link
                key={s.code}
                to="/code/source/$source"
                params={{ source: s.code }}
                className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)] ${bg}`}
              >
                {/* parchment overlay so text stays readable over the patriotic chaos */}
                <div className="absolute inset-0 bg-card/85 backdrop-blur-[2px] transition-opacity group-hover:bg-card/70" />
                <div className="relative">
                  <div className="citation-tag text-accent">{s.count.toLocaleString()} documents</div>
                  <div className="mt-1 font-display text-xl font-semibold">{s.name}</div>
                  <p className="mt-2 text-sm text-foreground/70">{desc.tagline}</p>
                  <div className="mt-4 font-mono text-xs text-muted-foreground group-hover:text-foreground/70">
                    Browse →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
