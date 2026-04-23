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
        <div className="citation-tag text-accent">a small manifesto</div>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">
          The law is for everybody. So it should{" "}
          <span className="ink-underline italic">read like it</span>.
        </h1>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/85">
          <p>
            Most legal research tools are built for lawyers staring at a single statute. Marginalia is for
            the rest of us — the side hustler, the renter, the small Etsy shop — trying to understand the rules
            around our actual lives.
          </p>
          <p>
            We pull from the same primary sources lawyers do: the Code of Federal Regulations, IRS manuals,
            Treasury procedures, the Uniform Commercial Code, FTC rules. Then we connect them, summarize them,
            and put the original right next to the plain-English version, so you can always verify.
          </p>
          <p className="font-display italic text-muted-foreground">
            Marginalia is not legal advice — it's a friendlier first read, with a clear path back to the source.
          </p>
        </div>
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-base text-primary-foreground shadow-[var(--shadow-warm)]"
          >
            Browse the topics →
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}