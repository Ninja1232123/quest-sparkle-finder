import { createFileRoute, Link } from "@tanstack/react-router";
import { listUscTitles, listUscSections, searchUsc } from "@/server/usc.functions";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useState } from "react";

export const Route = createFileRoute("/code")({
  loader: async () => {
    const [titlesRes, t1] = await Promise.all([
      listUscTitles(),
      listUscSections({ data: { titleNum: 1 } }),
    ]);
    return {
      titles: titlesRes.titles,
      title1Sections: t1.sections,
    };
  },
  component: CodePage,
  head: () => ({
    meta: [
      { title: "U.S. Code · Marginalia" },
      {
        name: "description",
        content:
          "Browse the United States Code section by section, with cross-references traced across titles.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl">Couldn't load the U.S. Code</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CodePage() {
  const { titles, title1Sections } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchUsc>>["hits"]>([]);
  const [searching, setSearching] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    const res = await searchUsc({ data: { q: q.trim() } });
    setHits(res.hits);
    setSearching(false);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">primary source</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          The <span className="ink-underline italic">U.S. Code</span>, in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          {titles.length} title{titles.length === 1 ? "" : "s"} indexed. Pilot ingest:
          Title {titles.join(", ")}. Citations between sections are traced and clickable.
        </p>

        <form onSubmit={onSearch} className="mt-8 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Code — e.g. 'singular includes plural', 'oath'"
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
                      {h.title_num} U.S.C. § {h.section_num}
                    </div>
                    <div className="mt-1 font-display text-base font-semibold">{h.heading}</div>
                    <p className="mt-2 text-sm text-foreground/75">{h.snippet}…</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12">
          <div className="citation-tag text-accent">Title 1 — General Provisions</div>
          <ul className="mt-3 divide-y divide-border/60 rounded-2xl border bg-card">
            {title1Sections.map((s: { id: string; identifier: string; section_num: string; heading: string | null }) => (
              <li key={s.id}>
                <Link
                  to="/code/$"
                  params={{ _splat: s.identifier.replace(/^\//, "") }}
                  className="flex items-baseline gap-4 px-5 py-3 hover:bg-muted/60"
                >
                  <span className="citation-tag w-20 shrink-0 text-muted-foreground">
                    § {s.section_num}
                  </span>
                  <span className="font-display text-sm font-semibold">{s.heading}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}