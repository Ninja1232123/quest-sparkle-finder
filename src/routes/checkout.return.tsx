import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
  head: () => ({ meta: [{ title: "Welcome to Pro · Marginalia" }] }),
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="citation-tag text-sage-deep">welcome to pro</div>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight">You're in.</h1>
        <p className="mt-4 text-foreground/70">
          {session_id
            ? "Payment complete. Pro tools unlock as features ship — every $5 buys real work, not vapor."
            : "If you got here without paying, no harm done. Head back when you're ready."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/code" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Open The Code
          </Link>
          <Link to="/whitepaper" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent">
            Read the roadmap
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
