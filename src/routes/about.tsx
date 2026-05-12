import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About · Marginalia" },
      {
        name: "description",
        content: "Why Marginalia exists: making the law readable for the people it actually applies to.",
      },
      { property: "og:title", content: "About · Marginalia" },
      {
        property: "og:description",
        content: "Why Marginalia exists: making the law readable for the people it actually applies to.",
      },
    ],
  }),
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-6 py-20">
        <div className="citation-tag text-accent">a working note</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
          The law is intentionally <span className="ink-underline italic">interlocking</span>. Read it that way.
        </h1>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/85">
          <p>
            Most legal-research tools are sold to professionals already fluent in the vocabulary. Marginalia is built
            for the citizen-researcher: someone who suspects a rule applies to them and wants to read it for themselves,
            in context, exactly as written.
          </p>
          <p>
            The connections between statutes, regulations, agency manuals, and the commercial code are not always made
            explicit — that opacity is part of how the system works. We index the primary sources, surface the
            cross-references, and put the plain-English summary side-by-side with the original text so you can always
            verify.
          </p>
          <p>
            Marginalia is not legal advice. It is a research aid. Use it the way a careful reader would use any
            reference work: to orient yourself, then to read the source.
          </p>
        </div>
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-base text-primary-foreground shadow-[var(--shadow-warm)]"
          >
            Open the index →
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
