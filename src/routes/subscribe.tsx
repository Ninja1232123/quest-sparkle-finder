import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { GitCompare, Highlighter, FileDown, Bell, Zap } from "lucide-react";

export const Route = createFileRoute("/subscribe")({
  component: SubscribePage,
  head: () => ({
    meta: [
      { title: "Go Pro · Marginalia" },
      {
        name: "description",
        content:
          "$5/month. Side-by-side compare, highlight, annotate, export to PDF, and keyword alerts across every codebook.",
      },
    ],
  }),
});

function SubscribePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="citation-tag text-sage-deep">Pro</div>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          $5/month. The full desk.
        </h1>
        <p className="mt-4 text-lg text-foreground/70">
          Reading is free. The power tools are five bucks. Less than a coffee.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {[
            { icon: GitCompare, h: "Side-by-side compare", p: "Same term, every codebook, in split panes." },
            { icon: Highlighter, h: "Highlight & annotate", p: "Mark sections. Leave yourself notes." },
            { icon: FileDown, h: "Export to PDF", p: "Cases, sections, and citations — clean output." },
            { icon: Bell, h: "Keyword alerts", p: "Get pinged when a rule changes or new docs land." },
          ].map(({ icon: Icon, h, p }) => (
            <div key={h} className="rounded-2xl border border-border/60 bg-card p-5">
              <Icon className="h-5 w-5 text-sage-deep" />
              <div className="mt-2 font-display font-semibold">{h}</div>
              <div className="mt-1 text-sm text-foreground/65">{p}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-sage-deep/30 bg-sage-deep/5 p-8 text-center">
          <p className="font-display text-sm uppercase tracking-wider text-muted-foreground">coming soon</p>
          <p className="mt-2 text-foreground/75">
            Checkout isn't live yet. Make a free account now and you'll be the first invited when Pro opens.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90"
          >
            <Zap className="h-4 w-4" />
            Create a free account
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
