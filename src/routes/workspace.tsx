import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MessageSquare } from "lucide-react";

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
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  useEffect(() => {
    if (!user) return;
    list().then((rows) => setThreads(rows as typeof threads)).catch(() => setThreads([]));
  }, [user, list]);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
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

  if (loading || !user) return <div className="p-8 text-muted-foreground">Loading workspace…</div>;

  return (
    <div className="flex h-[calc(100vh-64px)] w-full" style={{ background: "var(--paper, #f7f3ea)" }}>
      <aside className="flex w-72 flex-col border-r" style={{ background: "#0c1b3d", borderColor: "rgba(200,162,75,0.25)" }}>
        <div className="p-3">
          <Button onClick={newSession} className="w-full" style={{ background: "#c8a24b", color: "#0c1b3d" }}>
            <Plus className="h-4 w-4" /> New session
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {threads.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs" style={{ color: "rgba(230,236,247,0.55)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
              No sessions yet
            </div>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => {
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
          )}
        </div>
        <div className="border-t p-3 text-[10px] tracking-wider" style={{ borderColor: "rgba(200,162,75,0.2)", color: "rgba(230,236,247,0.45)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
          MARGINALIA · WORKSPACE
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}