import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LegalDisclaimer } from "@/components/marginalia/LegalDisclaimer";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Marginalia" },
      { name: "description", content: "AI-powered legal research and drafting workspace." },
    ],
  }),
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { mode: "login", redirect: "/workspace" } });
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="p-8 text-muted-foreground">Loading workspace…</div>;

  return (
    <div
      // `body` carries a global `zoom: 0.75`, which shrinks vh units so a plain
      // 100vh shell only fills 75% of the window. Divide by --site-zoom to reach
      // the real viewport floor — same compensation, and same no-fallback var,
      // as the .min-h-screen rule in styles.css: if the var is ever out of scope
      // the inline value voids and the h-screen class below takes over (100vh,
      // correct when there's no zoom to cancel).
      className="flex h-screen w-full overflow-hidden"
      style={{ height: "calc(100vh / var(--site-zoom))", background: "var(--paper, #f7f3ea)" }}
    >
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          {/* Top strip: a flush Home exit on the left, the not-legal-advice bar filling the rest. */}
          <div className="flex shrink-0 items-stretch">
            <Link
              to="/"
              title="Back to Marginalia home"
              className="flex items-center gap-1.5 border-b border-r px-3 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors hover:bg-black/[0.04]"
              style={{
                borderColor: "rgba(180,60,40,0.3)",
                background: "rgba(200,80,55,0.08)",
                color: "rgba(80,30,20,0.95)",
                fontFamily: "var(--font-mono, 'Special Elite')",
              }}
            >
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
            <div className="flex-1">
              <LegalDisclaimer variant="bar" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
