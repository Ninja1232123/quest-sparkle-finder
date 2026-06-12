import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getThreadMessages, getSessionDraft, upsertSessionDraft } from "@/lib/workspace.functions";
import { supabaseAuth } from "@/integrations/supabase/auth-client";
import { EditorCanvas, type EditorCanvasHandle } from "@/components/workspace/EditorCanvas";
import { RightRail } from "@/components/workspace/RightRail";
import type { CorpusHit } from "@/components/workspace/ResultCard";

export const Route = createFileRoute("/workspace/$threadId")({
  component: WorkspaceThreadPage,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
});

function WorkspaceThreadPage() {
  const { threadId } = Route.useParams();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const loadMessages = useServerFn(getThreadMessages);
  const loadDraft = useServerFn(getSessionDraft);
  const saveDraft = useServerFn(upsertSessionDraft);

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    setInitialMessages(null);
    setDraft(null);
    loadMessages({ data: { threadId } })
      .then((res) => {
        const msgs = (res.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role as UIMessage["role"],
          parts: (m.parts as UIMessage["parts"]) ?? [],
        }));
        setInitialMessages(msgs);
      })
      .catch(() => setInitialMessages([]));
    loadDraft({ data: { threadId } })
      .then((r) => {
        const row = r as { title?: string; body_md?: string } | null;
        setDraft({ title: row?.title ?? "Untitled draft", body: row?.body_md ?? "" });
      })
      .catch(() => setDraft({ title: "Untitled draft", body: "" }));
  }, [threadId, loadMessages, loadDraft]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/workspace/chat",
        headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
        body: { threadId },
      }),
    [threadId, token],
  );

  if (initialMessages === null || token === null || draft === null) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading session…</div>;
  }
  return (
    <Desk
      key={threadId}
      threadId={threadId}
      transport={transport}
      initialMessages={initialMessages}
      initialDraft={draft}
      saveDraft={saveDraft}
    />
  );
}

function Desk({
  threadId, transport, initialMessages, initialDraft, saveDraft,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  initialDraft: { title: string; body: string };
  saveDraft: (args: { data: { threadId: string; title: string; bodyMd: string } }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [body, setBody] = useState(initialDraft.body);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [rightMode, setRightMode] = useState<"dock" | "modal">(() => {
    if (typeof window === "undefined") return "dock";
    return (localStorage.getItem("workspace.rightMode") as "dock" | "modal") || "dock";
  });
  const editorRef = useRef<EditorCanvasHandle | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body });
  latestRef.current = { title, body };

  useEffect(() => { localStorage.setItem("workspace.rightMode", rightMode); }, [rightMode]);

  // Autosave: debounced + flush on unload / visibility hidden so nothing is lost.
  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    const snap = latestRef.current;
    setSaveState("saving");
    try {
      await saveDraft({ data: { threadId, title: snap.title || "Untitled draft", bodyMd: snap.body } });
      dirtyRef.current = false;
      setSaveState("saved");
      setSavedAt(Date.now());
    } catch {
      setSaveState("error");
    }
  }, [saveDraft, threadId]);

  useEffect(() => {
    dirtyRef.current = true;
    const t = setTimeout(() => { void flush(); }, 800);
    return () => clearTimeout(t);
  }, [title, body, flush]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") void flush(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        // Best-effort sync flush
        void flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush]);

  const handleAddToNotes = useCallback((hit: CorpusHit) => {
    const cite = `${hit.source.toUpperCase()} ${hit.sectionLabel || hit.identifier}`;
    const block = `> ${hit.snippet || hit.heading}\n> — ${cite}${hit.heading ? `, "${hit.heading}"` : ""}`;
    editorRef.current?.insertAtCursor(block);
    if (rightMode === "modal") setRightMode("dock");
  }, [rightMode]);

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorCanvas
            ref={editorRef}
            initialTitle={initialDraft.title}
            initialBody={initialDraft.body}
            saveState={saveState}
            lastSavedAt={savedAt}
            onChangeTitle={setTitle}
            onChangeBody={setBody}
            onOpenResearch={() => setRightMode((m) => (m === "dock" ? "modal" : "dock"))}
          />
        </div>
        <RightRail
          threadId={threadId}
          transport={transport}
          initialMessages={initialMessages}
          mode={rightMode}
          onModeChange={setRightMode}
          onAddToNotes={handleAddToNotes}
        />
      </div>
    </div>
  );
}