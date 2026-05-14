import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

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
  const [donationOpen, setDonationOpen] = useState(false);
  const [amount, setAmount] = useState(10);
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

        <div className="mt-20 rounded-3xl border border-sage-deep/30 bg-sage-deep/5 p-8">
          <div className="citation-tag text-sage-deep">vol. I · the plan</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Where this is going.
          </h2>
          <p className="mt-3 text-foreground/75 leading-relaxed">
            Marginalia today is six federal codebooks indexed together. Next is all 50 state codes,
            domain packs for the situations people actually search, a visible citation graph, alerts,
            and an honest research desk. The whitepaper lays it all out — and why $5/mo is the honest
            number to fund it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/whitepaper"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Read the whitepaper →
            </Link>
            <Link
              to="/subscribe"
              className="group relative inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-bold text-accent-foreground shadow-[var(--shadow-warm)] ring-2 ring-accent/40 ring-offset-2 ring-offset-background transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="absolute -top-2 -right-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                $5
              </span>
              ♥ Chip in / Go Pro
            </Link>
          </div>
          <p className="mt-3 text-xs italic text-muted-foreground">
            Reading the law stays free. Every $5 funds the next book on the shelf.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border-2 border-accent/40 bg-accent/5 p-8">
          <div className="citation-tag text-accent">no account required</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Or just toss a coin in the jar.
          </h2>
          <p className="mt-3 text-foreground/75 leading-relaxed">
            One-time donation. No subscription, no login, no follow-up emails.
            Goes straight to keeping the lights on and adding the next codebook.
          </p>
          {!donationOpen ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {[5, 10, 25, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    amount === v
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border hover:bg-accent/10"
                  }`}
                >
                  ${v}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={1000}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="h-10 w-24 rounded-full border border-border bg-background px-4 text-sm"
                aria-label="Custom amount"
              />
              <button
                onClick={() => setDonationOpen(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm font-bold text-accent-foreground shadow-[var(--shadow-warm)] hover:-translate-y-0.5 transition-transform"
              >
                ♥ Donate ${amount}
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <StripeEmbeddedCheckout donationCents={amount * 100} returnPath="/checkout/return" />
              <button
                onClick={() => setDonationOpen(false)}
                className="mt-3 text-xs text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
