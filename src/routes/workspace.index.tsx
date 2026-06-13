import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listThreads, createThread, getThreadMessages,
  searchCorpus, upsertCaseItem,
} from "@/lib/workspace.functions";
import { getOpinionsIndex } from "@/lib/opinions.functions";
import { supabaseAuth } from "@/integrations/supabase/auth-client";
import type { CorpusHit } from "@/components/workspace/ResultCard";
import { MarginNotepad, type NotepadHandle } from "@/components/workspace/desk/MarginNotepad";
import { ChatDock } from "@/components/workspace/desk/ChatDock";
import { CompileBuckets, type BucketId, type Snippet } from "@/components/workspace/desk/CompileBuckets";
import {
  SourceContainer, SOURCE_DEFS,
  type SourceId, type ContainerState,
} from "@/components/workspace/desk/SourceContainer";
import { ExpandedContainer } from "@/components/workspace/desk/ExpandedContainer";

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceDesk,
});

const STANCE_BY_BUCKET: Record<BucketId, "support" | "adverse" | "neutral"> = {
  supportive: "support",
  adversarial: "adverse",
  arguable: "neutral",
};

function WorkspaceDesk() {
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const loadMessages = useServerFn(getThreadMessages);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  // Bootstrap a working thread: reuse most recent, else create one.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = (await list()) as Array<{ id: string }>;
        let id = rows?.[0]?.id;
        if (!id) {
          const t = await create({ data: { title: "Research desk" } });
          id = t?.id;
        }
        if (!id || !alive) return;
        setThreadId(id);
        try {
          const res = await loadMessages({ data: { threadId: id } });
          if (!alive) return;
          setInitialMessages((res.messages ?? []).map((m) => ({
            id: m.id, role: m.role as UIMessage["role"], parts: (m.parts as UIMessage["parts"]) ?? [],
          })));
        } catch { /* no messages yet */ }
      } catch { /* DB unreachable — desk still works for search */ }
    })();
    return () => { alive = false; };
  }, [list, create, loadMessages]);

  if (!threadId || token === null) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Setting up your desk…</div>;
  }
  return <Desk threadId={threadId} token={token} initialMessages={initialMessages} />;
}

function Desk({ threadId, token, initialMessages }: { threadId: string; token: string; initialMessages: UIMessage[] }) {
  const runSearch = useServerFn(searchCorpus);
  const runOpinions = useServerFn(getOpinionsIndex);
  const saveItem = useServerFn(upsertCaseItem);

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/workspace/chat",
      headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
      body: { threadId },
    }),
    [threadId, token],
  );

  const notepadRef = useRef<NotepadHandle | null>(null);
  const [expanded, setExpanded] = useState<SourceId | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);

  const initial: Record<SourceId, ContainerState> = useMemo(() => {
    const base = {} as Record<SourceId, ContainerState>;
    for (const d of SOURCE_DEFS) base[d.id] = { query: "", loading: false, error: null, hits: null };
    return base;
  }, []);
  const [containers, setContainers] = useState<Record<SourceId, ContainerState>>(initial);

  const search = useCallback(async (id: SourceId, query: string) => {
    const def = SOURCE_DEFS.find((d) => d.id === id)!;
    setContainers((c) => ({ ...c, [id]: { ...c[id], query, loading: true, error: null } }));
    try {
      let hits: CorpusHit[];
      if (def.opinions) {
        const { items } = await runOpinions({ data: { q: query, page: 0 } });
        hits = (items ?? []).map((op) => ({
          identifier: `record/${op.slug}`,
          source: "opinions",
          heading: op.case_title,
          sectionLabel: op.us_cite ?? "",
          parentLabel: op.year ? String(op.year) : "",
          snippet: op.cited_count > 0 ? `${op.cited_count.toLocaleString()} citations on record.` : "",
        }));
      } else {
        hits = (await runSearch({ data: { q: query, source: def.corpus, limit: 15 } })) as CorpusHit[];
      }
      setContainers((c) => ({ ...c, [id]: { query, loading: false, error: null, hits } }));
    } catch (e) {
      setContainers((c) => ({ ...c, [id]: { ...c[id], loading: false, error: e instanceof Error ? e.message : "Search failed", hits: [] } }));
    }
  }, [runSearch, runOpinions]);

  // Deep dive: derive a query from the latest user chat message would be ideal;
  // for now seed each container with its label so the user can refine on expand.
  const deepDive = useCallback((id: SourceId) => {
    const def = SOURCE_DEFS.find((d) => d.id === id)!;
    void search(id, def.label);
    setExpanded(id);
  }, [search]);

  const pullSnippet = useCallback(async (args: { bucket: BucketId; text: string; hit: CorpusHit }) => {
    const { bucket, text, hit } = args;
    const citation = `${hit.source.toUpperCase()} ${hit.sectionLabel || hit.identifier}`;
    const local: Snippet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bucket, text, citation, identifier: hit.identifier, heading: hit.heading, source: hit.source,
    };
    setSnippets((s) => [...s, local]);
    // Persist to the case board (graceful if the DB is unreachable).
    try {
      const row = await saveItem({ data: {
        threadId, kind: "authority", stance: STANCE_BY_BUCKET[bucket],
        identifier: hit.identifier, citation, heading: hit.heading,
        quote: text, userNote: null,
      } }) as { id?: string };
      if (row?.id) setSnippets((s) => s.map((x) => (x.id === local.id ? { ...x, caseItemId: row.id } : x)));
    } catch { /* keep local-only */ }
  }, [saveItem, threadId]);

  const removeSnippet = useCallback((id: string) => {
    setSnippets((s) => s.filter((x) => x.id !== id));
  }, []);

  const sendToDraft = useCallback((s: Snippet) => {
    notepadRef.current?.insertAtCursor(`> ${s.text}\n> — ${s.citation}${s.heading ? `, "${s.heading}"` : ""}\n`);
  }, []);

  const onProposeSearch = useCallback((query: string, source?: string) => {
    // Route a model-proposed search into the best-matching container.
    const match = SOURCE_DEFS.find((d) => d.corpus && d.corpus === source) ?? SOURCE_DEFS[1];
    void search(match.id, query);
  }, [search]);

  const expandedDef = expanded ? SOURCE_DEFS.find((d) => d.id === expanded)! : null;

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
      {/* Margin notepad */}
      <div className="hidden min-h-0 lg:block">
        <MarginNotepad threadId={threadId} registerHandle={(h) => { notepadRef.current = h; }} />
      </div>

      {/* Center: containers + compile buckets */}
      <div className="relative flex min-h-0 flex-col gap-3 overflow-hidden p-3">
        <div className="shrink-0">
          <div className="text-[10px] uppercase tracking-[0.28em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
            Marginalia · Research Desk
          </div>
          <h1 className="text-[20px] font-semibold leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
            Five sources. Three verdicts. One remedy.
          </h1>
        </div>

        {/* Source containers grid */}
        <div className="grid min-h-0 shrink-0 grid-cols-2 gap-3 xl:grid-cols-5" style={{ height: "40%" }}>
          {SOURCE_DEFS.map((def) => (
            <SourceContainer
              key={def.id}
              def={def}
              state={containers[def.id]}
              onExpand={() => setExpanded(def.id)}
              onRunDeepDive={() => deepDive(def.id)}
            />
          ))}
        </div>

        {/* Compile buckets */}
        <div className="min-h-0 flex-1">
          <CompileBuckets snippets={snippets} onRemove={removeSnippet} onSendToDraft={sendToDraft} />
        </div>

        {/* Expanded reading overlay (covers only the center column) */}
        {expandedDef && (
          <ExpandedContainer
            def={expandedDef}
            state={containers[expandedDef.id]}
            onClose={() => setExpanded(null)}
            onSearch={(q) => void search(expandedDef.id, q)}
            onPullSnippet={pullSnippet}
          />
        )}
      </div>

      {/* Chat dock */}
      <div className="hidden min-h-0 lg:block">
        <ChatDock threadId={threadId} transport={transport} initialMessages={initialMessages} onProposeSearch={onProposeSearch} />
      </div>
    </div>
  );
}
