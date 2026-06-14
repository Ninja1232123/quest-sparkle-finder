import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread } from "@/lib/workspace.functions";

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceIndexRedirect,
});

// Bare /workspace has no layout of its own — it bootstraps a working thread
// (reuse the most recent, else create one) and hands off to /workspace/$threadId,
// which renders the single deck layout. Keeps one layout instead of two.
function WorkspaceIndexRedirect() {
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = (await list()) as Array<{ id: string }>;
        let id = rows?.[0]?.id;
        if (!id) {
          const t = await create({ data: {} });
          id = t?.id;
        }
        if (id && alive) {
          navigate({ to: "/workspace/$threadId", params: { threadId: id }, replace: true });
        }
      } catch {
        /* DB unreachable — leave the loading state up */
      }
    })();
    return () => { alive = false; };
  }, [list, create, navigate]);

  return <div className="flex h-full items-center justify-center text-muted-foreground">Setting up your desk…</div>;
}
