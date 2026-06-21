import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
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
<<<<<<< HEAD
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          {/* Top strip: a flush Home exit on the left, the not-legal-advice bar filling the rest. */}
          <div className="flex shrink-0 items-stretch">
=======
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-stretch" style={{ background: "var(--navy-deep, #0c1b3d)" }}>
>>>>>>> f4f8c5cc093f289916a8091caf08700cac22bc8f
            <Link
              to="/"
              aria-label="Back to home"
              className="group flex shrink-0 items-center gap-2 px-4 text-[13px] font-bold uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "#c8a24b",
                color: "#0c1b3d",
                fontFamily: "var(--font-mono, 'Special Elite')",
                boxShadow: "inset -1px 0 0 rgba(0,0,0,0.25)",
              }}
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <LegalDisclaimer variant="bar" className="flex-1 border-b-0" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
