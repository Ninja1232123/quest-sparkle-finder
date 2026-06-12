import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread } from "@/lib/workspace.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceIndex,
});

function WorkspaceIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const threads = await list();
      if (threads.length > 0) {
        navigate({ to: "/workspace/$threadId", params: { threadId: threads[0].id }, replace: true });
      } else {
        const t = await create({ data: {} });
        if (t?.id) navigate({ to: "/workspace/$threadId", params: { threadId: t.id }, replace: true });
      }
    })();
  }, [user, loading, list, create, navigate]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground" style={{ fontFamily: "var(--font-mono, 'Special Elite')" }}>
      Opening workspace…
    </div>
  );
}