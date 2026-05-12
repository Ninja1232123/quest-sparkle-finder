import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? "signup" : "login",
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Marginalia" },
      { name: "description", content: "Sign in to save citations to your Cases." },
    ],
  }),
});

function AuthPage() {
  const { mode, redirect } = useSearch({ from: "/auth" });
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: redirect ?? "/cases" });
  }, [user, loading, navigate, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = isSignup
      ? await signUp(email, password, displayName || undefined)
      : await signIn(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (isSignup) {
      setInfo("Check your email to confirm your account, then sign in.");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="citation-tag text-muted-foreground">{isSignup ? "create account" : "sign in"}</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {isSignup ? "Build your reading desk." : "Welcome back."}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          {isSignup
            ? "Save citations into named Cases — a personal binder for whatever you're researching."
            : "Sign in to your Cases and bookmarks."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {isSignup && (
            <div>
              <label className="font-display text-xs uppercase tracking-wider text-muted-foreground" htmlFor="dn">
                Display name (optional)
              </label>
              <input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-foreground/15 bg-background px-3 font-display text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="font-display text-xs uppercase tracking-wider text-muted-foreground" htmlFor="em">
              Email
            </label>
            <input
              id="em"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-foreground/15 bg-background px-3 font-display text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="font-display text-xs uppercase tracking-wider text-muted-foreground" htmlFor="pw">
              Password
            </label>
            <input
              id="pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-foreground/15 bg-background px-3 font-display text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-foreground/80">
              {info}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-foreground font-display text-sm text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <button onClick={() => setIsSignup(false)} className="text-foreground underline">
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button onClick={() => setIsSignup(true)} className="text-foreground underline">
                Create an account
              </button>
            </>
          )}
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/code" className="hover:text-foreground">Browse the Code without an account →</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}