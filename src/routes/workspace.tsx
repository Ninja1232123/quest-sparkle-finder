import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MessageSquare, Search } from "lucide-react";
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
  const params = useParams({ strict: false }) as { threadId?: string };
  const [threads, setThreads] = useState<Array<{ id: string; title: string; last_message_at: string }>>([]);
  const [filter, setFilter] = useState("");
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  useEffect(() => {
    if (!user) return;
    list().then((rows) => setThreads(rows as typeof threads)).catch(() => setThreads([]));
  }, [user, list]);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { mode: "login", redirect: "/workspace" } });
  }, [user, loading, navigate]);

  async function newSession() {
    const t = await create({ data: {} });
    if (t?.id) {
      setThreads((prev) => [{ id: t.id, title: t.title, last_message_at: t.last_message_at }, ...prev]);
      navigate({ to: "/workspace/$threadId", params: { threadId: t.id } });
    }
  }

  async function removeThread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this session?")) return;
    await del({ data: { threadId: id } });
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (params.threadId === id) navigate({ to: "/workspace" });
  }

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads;
    const now = Date.now();
    const DAY = 86400000;
    const groups: Record<string, typeof threads> = { Today: [], Yesterday: [], "This week": [], Older: [] };
    for (const t of filtered) {
      const age = now - new Date(t.last_message_at).getTime();
      if (age < DAY) groups.Today.push(t);
      else if (age < 2 * DAY) groups.Yesterday.push(t);
      else if (age < 7 * DAY) groups["This week"].push(t);
      else groups.Older.push(t);
    }
    return groups;
  }, [threads, filter]);

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
      <aside className="flex w-72 flex-col border-r" style={{ background: "#0c1b3d", borderColor: "rgba(200,162,75,0.25)" }}>
        <div className="space-y-2 p-3">
          <Button onClick={newSession} className="w-full" style={{ background: "#c8a24b", color: "#0c1b3d" }}>
            <Plus className="h-4 w-4" /> New session
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "rgba(230,236,247,0.5)" }} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter sessions…"
              className="w-full rounded-md border bg-transparent py-1.5 pl-7 pr-2 text-xs outline-none placeholder:opacity-60"
              style={{ borderColor: "rgba(200,162,75,0.25)", color: "#e6ecf7", fontFamily: "var(--font-mono, 'Special Elite')" }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {threads.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs" style={{ color: "rgba(230,236,247,0.55)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
              No sessions yet
            </div>
          ) : (
            <div className="space-y-4">
              {(["Today", "Yesterday", "This week", "Older"] as const).map((label) =>
                grouped[label].length === 0 ? null : (
                  <div key={label}>
                    <div className="px-2 pb-1 text-[9px] tracking-[0.3em]" style={{ color: "rgba(230,236,247,0.4)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
                      {label.toUpperCase()}
                    </div>
                    <ul className="space-y-0.5">
                      {grouped[label].map((t) => {
                        const active = params.threadId === t.id;
                        return (
                          <li key={t.id}>
                            <Link
                              to="/workspace/$threadId"
                              params={{ threadId: t.id }}
                              className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
                              style={{
                                background: active ? "rgba(200,162,75,0.18)" : "transparent",
                                color: active ? "#fff" : "#e6ecf7",
                                borderLeft: active ? "2px solid #c8a24b" : "2px solid transparent",
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <span className="flex-1 truncate" style={{ fontFamily: "var(--font-serif, 'Cinzel')", fontSize: 13 }}>
                                {t.title}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => removeThread(t.id, e)}
                                className="opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
                                aria-label="Delete session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t p-3" style={{ borderColor: "rgba(200,162,75,0.2)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
          <Link to="/cases" className="block text-[10px] tracking-wider opacity-60 hover:opacity-100" style={{ color: "#e6ecf7" }}>↳ CASEBOOK</Link>
          <Link to="/builder" className="block text-[10px] tracking-wider opacity-60 hover:opacity-100" style={{ color: "#e6ecf7" }}>↳ PLEADING BUILDER</Link>
          <div className="pt-2 text-[10px] tracking-wider" style={{ color: "rgba(230,236,247,0.35)" }}>
            MARGINALIA · WORKSPACE
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <LegalDisclaimer variant="bar" />
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}