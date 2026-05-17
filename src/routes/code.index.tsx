import { createFileRoute, Link } from "@tanstack/react-router";
import { listSources, searchDocuments } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useState } from "react";
import { Map, Network, History, Scale } from "lucide-react";
import { ComingSoonCard, ComingSoonHeader } from "@/components/marginalia/ComingSoon";
import { sourceMeta } from "@/lib/source-groups";

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

  const rightRail = (
    <div className="space-y-5 text-sm">
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">at a glance</div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="font-mono text-xs text-muted-foreground">documents indexed</div>
          <div className="mt-0.5 font-display text-2xl font-semibold">{totalDocs.toLocaleString()}</div>
          <div className="mt-1 text-xs text-muted-foreground">across {sources.length} sources · updated May 2026</div>
        </div>
      </div>
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">soon · here</div>
        <div className="rounded-lg border border-dashed border-border/70 bg-card/30 p-3 text-xs text-foreground/65">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Network className="h-3.5 w-3.5" />
            Citation graph
          </div>
          <p className="mt-1 leading-relaxed">
            When you open a section, this rail will show what cites it and what it cites — across all
            codebooks. The map renders here.
          </p>
        </div>
      </div>
      <div>
        <div className="citation-tag mb-1.5 text-muted-foreground">jump to</div>
        <ul className="space-y-1 text-xs">
          <li>
            <Link to="/search" search={{ q: "due process", source: "" }} className="text-foreground/75 hover:text-foreground hover:underline">
              "due process" across all sources
            </Link>
          </li>
          <li>
            <Link to="/compare" search={{ q: "right to cure", sources: "usc,cfr,ucc" }} className="text-foreground/75 hover:text-foreground hover:underline">
              Compare "right to cure"
            </Link>
          </li>
          <li>
            <Link to="/search" search={{ q: "15 USC 1692", source: "" }} className="text-foreground/75 hover:text-foreground hover:underline">
              Find 15 U.S.C. § 1692
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <ResearchShell sources={sources} right={rightRail} rightLabel="The desk" centerMaxWidth="max-w-4xl">
      <section className="relative">
        <div className="citation-tag text-muted-foreground">primary sources</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          The <span className="ink-underline italic">Code</span>, in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          {totalDocs.toLocaleString()} documents across {sources.length} source{sources.length === 1 ? "" : "s"}.
          Citations between them are traced and clickable, even across sources.
        </p>

        <form onSubmit={onSearch} className="mt-8 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="code-source-filter" className="sr-only">Filter by source</label>
          <select
            id="code-source-filter"
            value={source ?? ""}
            onChange={(e) => setSource(e.target.value || undefined)}
            className="h-12 rounded-full border border-foreground/15 bg-background/90 px-4 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          >
            <option value="">All sources</option>
            {sources.map((s: { code: string; name: string }) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          <label htmlFor="code-search-input" className="sr-only">Search the codebooks</label>
          <input
            id="code-search-input"
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
            const meta = sourceMeta(s.code);
            const accent = meta.accent;
            return (
              <Link
                key={s.code}
                to="/code/source/$source"
                params={{ source: s.code }}
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 pl-7 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)]"
                style={{
                  borderLeft: `6px solid ${accent}`,
                  backgroundImage: `linear-gradient(135deg, ${accent}14 0%, transparent 55%)`,
                }}
              >
                <div className="relative">
                  <div className="citation-tag" style={{ color: accent }}>
                    {s.count.toLocaleString()} documents
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold">{s.name}</div>
                  <p className="mt-2 text-sm text-foreground/70">{meta.tagline ?? "Browse this source."}</p>
                  <div className="mt-4 font-mono text-xs text-muted-foreground group-hover:text-foreground/70">
                    Browse →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Vision strip — shelves we haven't filled yet */}
        <div className="mt-16">
          <ComingSoonHeader
            eyebrow="shelves under construction"
            title="The other half of the library."
            subtitle="The federal floor is open. These wings are framed but not yet stocked."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ComingSoonCard
              icon={Map}
              status="building"
              title="All 50 state codes"
              pitch="Statutes, constitutions, and agency regs from every state — searchable in the same bar as the federal codebooks."
            />
            <ComingSoonCard
              icon={Scale}
              status="soon"
              title="Federal caselaw"
              pitch="Supreme Court and circuit opinions wired into the sections they interpret, with the holdings pulled to the top."
            />
            <ComingSoonCard
              icon={Network}
              status="soon"
              title="Citation graph"
              pitch="Every section shows what cites it and what it depends on — a real map between statutes, regulations, and agency manuals."
            />
            <ComingSoonCard
              icon={History}
              status="vision"
              title="Historical versions"
              pitch="Slide back through every prior version of any section. See exactly what changed, and which Public Law did it."
            />
          </div>
        </div>
      </section>
    </ResearchShell>
  );
}
