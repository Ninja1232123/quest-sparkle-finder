import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession } from "@/utils/payments.functions";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "Account · Marginalia" },
      {
        name: "description",
        content:
          "Manage your Marginalia account: subscription, billing portal access, and Pro features for legal research.",
      },
      { property: "og:title", content: "Account · Marginalia" },
      { property: "og:description", content: "Manage your Marginalia subscription and Pro access." },
      { property: "og:url", content: "https://self-law.org/account" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/account" }],
  }),
});

function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { sub, isPro, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login", redirect: "/account" } });
  }, [authLoading, user, navigate]);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const url = await createPortalSession({ data: { returnPath: "/account" } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <section className="mx-auto max-w-2xl px-6 py-20 text-foreground/60">Loading…</section>
      </div>
    );
  }

  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <div className="citation-tag text-muted-foreground">your account</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Account</h1>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">signed in as</div>
          <div className="mt-1 text-lg font-semibold">{user.email}</div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="mt-4 text-sm text-muted-foreground underline hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">subscription</div>
          {subLoading ? (
            <div className="mt-2 text-foreground/60">Checking…</div>
          ) : !sub ? (
            <>
              <div className="mt-1 text-lg font-semibold">Free reader</div>
              <p className="mt-2 text-sm text-foreground/70">
                Reading is free. Pro unlocks compare, highlight, annotate, export, and alerts.
              </p>
              <Link
                to="/subscribe"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
              >
                Go Pro — $5/mo
              </Link>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-semibold">
                {isPro ? "Marginalia Pro" : "Inactive"}{" "}
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                  {sub.status}
                </span>
              </div>
              {periodEnd && (
                <p className="mt-2 text-sm text-foreground/70">
                  {sub.cancel_at_period_end
                    ? `Cancels on ${periodEnd.toLocaleDateString()}.`
                    : `Renews on ${periodEnd.toLocaleDateString()}.`}
                </p>
              )}
              <button
                onClick={openPortal}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
              >
                {busy ? "Opening…" : "Manage billing"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Opens Stripe in a new tab — cancel, update card, or download invoices there.
              </p>
              {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
            </>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}