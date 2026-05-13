import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/chambers")({
  component: ChambersPage,
  head: () => ({
    meta: [
      { title: "In Chambers · Marginalia" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Off the record." },
    ],
  }),
});

function ChambersPage() {
  return (
    <div className="min-h-screen bg-[var(--ink)] text-background">
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-background/40">
          ⬆ ⬆ ⬇ ⬇ ⬅ ➡ ⬅ ➡ B A
        </div>
        <h1 className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
          In <span className="italic text-[var(--ochre)]">chambers</span>.
        </h1>
        <p className="mt-8 max-w-lg font-display text-xl italic leading-relaxed text-background/70">
          Off the record. No bailiff. No transcript.
        </p>
        <p className="mt-6 max-w-lg text-sm leading-relaxed text-background/60">
          You found the back room. Nothing in here is a legal theory. Nothing in here is
          legal advice. The robe comes off, the dictionary stays open, and the people in
          here mostly just want to know what the rules actually say before someone in a
          uniform tells them they don't.
        </p>
        <p className="mt-10 max-w-lg font-mono text-[11px] uppercase tracking-wider text-background/40">
          rule 1 — read it yourself. rule 2 — cite it or shut up. rule 3 — see rule 1.
        </p>
        <div className="mt-12 flex gap-4">
          <Link
            to="/"
            className="rounded-full border border-background/20 px-5 py-2 text-sm text-background/80 hover:border-background/60 hover:text-background"
          >
            ← back to the record
          </Link>
          <Link
            to="/forum"
            className="rounded-full bg-[var(--ochre)] px-5 py-2 text-sm font-semibold text-[var(--ink)] hover:opacity-90"
          >
            take it to The Floor
          </Link>
        </div>
      </section>
      <div className="border-t border-background/10">
        <SiteFooter />
      </div>
    </div>
  );
}
