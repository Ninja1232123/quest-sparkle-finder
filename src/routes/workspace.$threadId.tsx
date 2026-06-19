import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getThreadMessages, getSessionDraft, upsertSessionDraft,
  listCaseItems, upsertCaseItem, deleteCaseItem,
  snapshotDraft, listDraftVersions, citeCheck,
  getCorpusDocument, type CorpusDoc,
} from "@/lib/workspace.functions";
import { supabaseAuth } from "@/integrations/supabase/auth-client";
import { EditorCanvas, type EditorCanvasHandle } from "@/components/workspace/EditorCanvas";
import { type CaseItem } from "@/components/workspace/CaseBoard";
import { PinDialog, type PinDraft } from "@/components/workspace/PinDialog";
import { CiteCheckSheet, type CiteCheckResult } from "@/components/workspace/CiteCheckSheet";
import { Panel } from "@/components/workspace/deck/Panel";
import { SourceReader } from "@/components/workspace/deck/SourceReader";
import { RefinedIssues } from "@/components/workspace/deck/RefinedIssues";
import { ModelContainer } from "@/components/workspace/deck/ModelContainer";
import { DocViewer } from "@/components/workspace/deck/DocViewer";
import { SessionMenu } from "@/components/workspace/deck/SessionMenu";
import { X } from "lucide-react";

export const Route = createFileRoute("/workspace/$threadId")({
  component: WorkspaceThreadPage,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
});

function WorkspaceThreadPage() {
  const { threadId } = Route.useParams();
  const { q: seedPrompt } = Route.useSearch();
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

  // The document the user currently has open in the reader. Held in a ref so the
  // chat transport can read the latest value at send time without rebuilding.
  const focusRef = useRef<{ ref: string } | null>(null);
  // The user's live draft (title + body) from the Doc Creator editor, held in a
  // ref so the model can see what's actually on the page at send time.
  const draftRef = useRef<{ title: string; body: string } | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/workspace/chat",
        headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
        body: { threadId },
        // Merge the focused-document ref and the live draft into every send so the
        // model reads what the user is reading AND what they've written so far.
        // Must preserve the default body fields we override.
        prepareSendMessagesRequest: ({ body, messages, id, trigger, messageId }) => ({
          body: {
            ...body, id, messages, trigger, messageId,
            focusedRef: focusRef.current?.ref ?? null,
            draftTitle: draftRef.current?.title ?? null,
            draftText: draftRef.current?.body ?? null,
          },
        }),
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
      focusRef={focusRef}
      draftRef={draftRef}
      initialMessages={initialMessages}
      initialDraft={draft}
      saveDraft={saveDraft}
      seedPrompt={seedPrompt}
    />
  );
}

function Desk({
  threadId, transport, focusRef, draftRef, initialMessages, initialDraft, saveDraft, seedPrompt,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  focusRef: React.MutableRefObject<{ ref: string } | null>;
  draftRef: React.MutableRefObject<{ title: string; body: string } | null>;
  initialMessages: UIMessage[];
  initialDraft: { title: string; body: string };
  saveDraft: (args: { data: { threadId: string; title: string; bodyMd: string } }) => Promise<unknown>;
  seedPrompt?: string;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [body, setBody] = useState(initialDraft.body);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [docOpen, setDocOpen] = useState(false);

  // Shared document focus — the reader the user opens over the Sources column.
  const getDoc = useServerFn(getCorpusDocument);
  const [focusDoc, setFocusDoc] = useState<CorpusDoc | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusLoading, setFocusLoading] = useState(false);
  const handleOpenDoc = useCallback(async (ref: string) => {
    setFocusOpen(true);
    setFocusLoading(true);
    focusRef.current = { ref }; // model picks this up on the next message
    try {
      setFocusDoc((await getDoc({ data: { ref } })) as CorpusDoc);
    } catch {
      setFocusDoc(null);
    } finally {
      setFocusLoading(false);
    }
  }, [getDoc, focusRef]);
  const handleCloseDoc = useCallback(() => {
    setFocusOpen(false);
    setFocusDoc(null);
    focusRef.current = null;
  }, [focusRef]);

  // When the assistant fetches a document via its tools, mirror that into the
  // user's reader so they see exactly what the model is reading. No prompt to
  // act — just shared focus.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ ref?: string }>).detail;
      if (d?.ref) void handleOpenDoc(d.ref);
    };
    window.addEventListener("workspace:open-doc", onOpen);
    return () => window.removeEventListener("workspace:open-doc", onOpen);
  }, [handleOpenDoc]);

  const editorRef = useRef<EditorCanvasHandle | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({ title, body });
  latestRef.current = { title, body };
  // Keep the shared draft ref current so the chat transport sends the live draft.
  draftRef.current = { title, body };

  // Case Board state
  const loadItems = useServerFn(listCaseItems);
  const saveItem = useServerFn(upsertCaseItem);
  const removeItem = useServerFn(deleteCaseItem);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const refreshItems = useCallback(async () => {
    try {
      const rows = await loadItems({ data: { threadId } });
      setCaseItems(rows as CaseItem[]);
    } catch { /* ignore */ }
  }, [loadItems, threadId]);
  useEffect(() => { void refreshItems(); }, [refreshItems]);

  // Pin dialog state
  const [pinDraft, setPinDraft] = useState<PinDraft | null>(null);

  // Cite-check state
  const runCiteCheck = useServerFn(citeCheck);
  const [citeOpen, setCiteOpen] = useState(false);
  const [citeLoading, setCiteLoading] = useState(false);
  const [citeError, setCiteError] = useState<string | null>(null);
  const [citeResults, setCiteResults] = useState<CiteCheckResult[] | null>(null);

  // Versions state
  const snap = useServerFn(snapshotDraft);
  const loadVersions = useServerFn(listDraftVersions);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; title: string | null; created_at: string; body_md: string }>>([]);

  // Autosave: debounced + flush on unload / visibility hidden so nothing is lost.
  const lastSnapshotAt = useRef(0);
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

  // Snapshot a version at most every 60s while dirty, so users have rollback points.
  useEffect(() => {
    if (!body) return;
    const now = Date.now();
    if (now - lastSnapshotAt.current < 60_000) return;
    lastSnapshotAt.current = now;
    void snap({ data: { threadId, title: latestRef.current.title, bodyMd: latestRef.current.body } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, threadId]);

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

  const handleAddToDraft = useCallback((markdown: string) => {
    setDocOpen(true);
    editorRef.current?.insertAtCursor(markdown);
  }, []);

  // Pending AI-proposed draft edits — awaiting user Accept / Revert.
  type PendingEdit = { id: string; kind: "insert" | "replace"; anchor: string | null; markdown: string; why: string };
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  useEffect(() => {
    const onPropose = (e: Event) => {
      const d = (e as CustomEvent<PendingEdit>).detail;
      if (!d?.id || !d.markdown) return;
      const kind: PendingEdit["kind"] = d.kind === "replace" ? "replace" : "insert";
      setPendingEdits((cur) => (cur.some((p) => p.id === d.id) ? cur : [...cur, { ...d, kind }]));
      setDocOpen(true);
    };
    window.addEventListener("workspace:propose-edit", onPropose);
    return () => window.removeEventListener("workspace:propose-edit", onPropose);
  }, []);

  const acceptEdit = useCallback((edit: PendingEdit) => {
    const current = editorRef.current?.getBody() ?? body;
    let next = current;
    if (edit.kind === "replace" && edit.anchor && current.includes(edit.anchor)) {
      next = current.replace(edit.anchor, edit.markdown);
    } else if (edit.kind === "insert" && edit.anchor && current.includes(edit.anchor)) {
      const idx = current.indexOf(edit.anchor) + edit.anchor.length;
      next = current.slice(0, idx) + "\n\n" + edit.markdown + current.slice(idx);
    } else {
      next = current + (current.trim() ? "\n\n" : "") + edit.markdown;
    }
    setBody(next);
    // Force-sync the contenteditable so the user sees it land.
    setTimeout(() => {
      const root = document.querySelector("[contenteditable]") as HTMLDivElement | null;
      if (root) root.innerText = next;
    }, 0);
    setPendingEdits((cur) => cur.filter((p) => p.id !== edit.id));
  }, [body]);

  const revertEdit = useCallback((id: string) => {
    setPendingEdits((cur) => cur.filter((p) => p.id !== id));
  }, []);

  const updatePendingMarkdown = useCallback((id: string, markdown: string) => {
    setPendingEdits((cur) => cur.map((p) => (p.id === id ? { ...p, markdown } : p)));
  }, []);

  // Grab → file straight onto the issues board with the stance picked at the source.
  const handleQuickAddIssue = useCallback(async (d: PinDraft) => {
    await saveItem({ data: {
      threadId, kind: "authority", stance: d.stance,
      identifier: d.identifier ?? null, citation: d.citation ?? null,
      heading: d.heading ?? null, pinCite: d.pinCite ?? null,
      quote: d.quote ?? null, userNote: d.userNote ?? null,
    } });
    await refreshItems();
  }, [saveItem, threadId, refreshItems]);

  const handleInsertItem = useCallback((item: CaseItem) => {
    const cite = item.citation || item.identifier || "";
    const pin = item.pin_cite ? ` ${item.pin_cite}` : "";
    const block = item.quote
      ? `> ${item.quote}\n> — ${cite}${pin}`
      : `${cite}${pin}`;
    editorRef.current?.insertAtCursor(block);
  }, []);

  const handleOpenPin = useCallback((draft: PinDraft) => {
    setPinDraft(draft);
  }, []);

  const handleSavePin = useCallback(async (d: PinDraft) => {
    await saveItem({ data: {
      threadId,
      kind: "authority",
      stance: d.stance,
      identifier: d.identifier ?? null,
      citation: d.citation ?? null,
      heading: d.heading ?? null,
      pinCite: d.pinCite ?? null,
      quote: d.quote ?? null,
      userNote: d.userNote ?? null,
    } });
    await refreshItems();
  }, [saveItem, threadId, refreshItems]);

  const handleAddQuestion = useCallback(async (text: string) => {
    await saveItem({ data: { threadId, kind: "question", userNote: text } });
    await refreshItems();
  }, [saveItem, threadId, refreshItems]);

  const handleAddQuestionPrompt = useCallback(async () => {
    const t = window.prompt("Add a research question for your case:");
    if (!t || !t.trim()) return;
    await handleAddQuestion(t.trim());
  }, [handleAddQuestion]);

  const handleDeleteItem = useCallback(async (item: CaseItem) => {
    await removeItem({ data: { id: item.id } });
    await refreshItems();
  }, [removeItem, refreshItems]);

  const handleCiteCheck = useCallback(async () => {
    setCiteOpen(true);
    setCiteLoading(true);
    setCiteError(null);
    try {
      const text = editorRef.current?.getBody() ?? body;
      const res = await runCiteCheck({ data: { threadId, text } });
      setCiteResults((res as { cites: CiteCheckResult[] }).cites);
    } catch (e) {
      setCiteError(e instanceof Error ? e.message : "Cite check failed");
    } finally {
      setCiteLoading(false);
    }
  }, [body, runCiteCheck, threadId]);

  const handleOpenVersions = useCallback(async () => {
    setVersionsOpen(true);
    try {
      const rows = await loadVersions({ data: { threadId } });
      setVersions(rows as typeof versions);
    } catch { /* ignore */ }
  }, [loadVersions, threadId]);

  const handleRestoreVersion = useCallback((v: { title: string | null; body_md: string }) => {
    if (!window.confirm("Replace your current draft with this version? Your current draft is also saved in versions.")) return;
    // Snapshot current before replacing
    void snap({ data: { threadId, title, bodyMd: body } }).catch(() => {});
    setTitle(v.title ?? title);
    setBody(v.body_md);
    if (editorRef.current) {
      // Force re-seed
      const el = (editorRef.current as unknown as { focus: () => void });
      el.focus();
    }
    // Rebuild the contenteditable text
    setTimeout(() => {
      const root = document.querySelector("[contenteditable]") as HTMLDivElement | null;
      if (root) root.innerText = v.body_md;
    }, 0);
    setVersionsOpen(false);
  }, [body, snap, threadId, title]);

  return (
    <div
      className="flex h-full min-h-0 w-full gap-3 p-3"
      style={{
        background: "var(--navy-deep, #0c1b3d)",
        backgroundImage: "radial-gradient(1200px 600px at 25% -15%, rgba(200,162,75,0.07), transparent)",
      }}
    >
      {/* Sources — split statute / case law, with the reader overlaying it when a doc is open */}
      <div className="relative flex min-w-0 flex-[1.7]">
        <SourceReader onAddIssue={handleQuickAddIssue} onAddToDraft={handleAddToDraft} onOpenDoc={handleOpenDoc} />
        {focusOpen && (
          <div className="absolute inset-0 flex">
            <DocViewer doc={focusDoc} loading={focusLoading} onClose={handleCloseDoc} />
          </div>
        )}
      </div>

      {/* Refined issues, with the Doc Creator overlaying this column when open */}
      <div className="relative flex min-w-0 flex-[1.4]">
        <RefinedIssues
          items={caseItems}
          docOpen={docOpen}
          onToggleDoc={() => setDocOpen((v) => !v)}
          onInsert={handleInsertItem}
          onDelete={handleDeleteItem}
          onAddQuestion={handleAddQuestionPrompt}
        />
        {/* Always mounted (keeps autosave + editor ref); revealed over the column when open. */}
        <div
          className={`absolute inset-0 flex ${docOpen ? "" : "pointer-events-none opacity-0"}`}
          style={{ transition: "opacity 140ms ease" }}
        >
          <Panel
            label="Doc Creator"
            accent="#7bb651"
            className="w-full"
            bodyClassName="flex bg-white"
            headerRight={
              <button
                type="button"
                onClick={() => setDocOpen(false)}
                className="grid h-6 w-6 place-items-center rounded hover:bg-white/10"
                style={{ color: "#cfe3bf" }}
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            }
          >
            <EditorCanvas
              ref={editorRef}
              initialTitle={initialDraft.title}
              initialBody={initialDraft.body}
              saveState={saveState}
              lastSavedAt={savedAt}
              supportCount={caseItems.filter((i) => i.kind === "authority" && i.stance !== "adverse").length}
              questionCount={caseItems.filter((i) => i.kind === "question").length}
              onChangeTitle={setTitle}
              onChangeBody={setBody}
              onOpenResearch={() => setDocOpen(false)}
              onCiteCheck={handleCiteCheck}
              onOpenVersions={handleOpenVersions}
            />
          </Panel>
        </div>
      </div>

      {/* Assistant */}
      <div className="flex min-w-0 flex-1">
        <ModelContainer
          threadId={threadId}
          transport={transport}
          initialMessages={initialMessages}
          seedPrompt={seedPrompt}
          onPin={handleOpenPin}
          onAddQuestion={handleAddQuestion}
          onAddToDraft={handleAddToDraft}
          headerRight={<SessionMenu currentId={threadId} />}
        />
      </div>

      <PinDialog
        open={pinDraft !== null}
        draft={pinDraft}
        onClose={() => setPinDraft(null)}
        onSave={handleSavePin}
      />
      <CiteCheckSheet
        open={citeOpen}
        loading={citeLoading}
        results={citeResults}
        error={citeError}
        onClose={() => setCiteOpen(false)}
        onPin={(r) => setPinDraft({
          identifier: r.identifier,
          citation: r.citation,
          stance: "support",
          quote: "",
          pinCite: "",
          userNote: "",
        })}
      />
      {versionsOpen && (
        <VersionsModal
          versions={versions}
          onClose={() => setVersionsOpen(false)}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
}

function VersionsModal({
  versions, onClose, onRestore,
}: {
  versions: Array<{ id: string; title: string | null; created_at: string; body_md: string }>;
  onClose: () => void;
  onRestore: (v: { title: string | null; body_md: string }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in oklab, var(--ink) 55%, transparent)" }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border shadow-2xl" style={{ background: "var(--paper)", borderColor: "var(--brass, #c8a24b)" }}>
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
          <div>
            <div className="text-[12px] tracking-[0.25em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>Versions</div>
            <div className="text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>Saved snapshots of this draft</div>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-foreground/5">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {versions.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
              No versions yet. The draft snapshots every minute while you type.
            </div>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="rounded border p-2" style={{ borderColor: "var(--rule-card)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>{v.title || "Untitled"}</div>
                      <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{new Date(v.created_at).toLocaleString()} · {v.body_md.length} chars</div>
                    </div>
                    <button type="button" onClick={() => onRestore(v)} className="rounded px-2 py-1 text-[12px] font-medium text-white" style={{ background: "var(--ink)" }}>
                      Restore
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px]" style={{ color: "var(--ink-muted)" }}>{v.body_md.slice(0, 200)}{v.body_md.length > 200 ? "…" : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}