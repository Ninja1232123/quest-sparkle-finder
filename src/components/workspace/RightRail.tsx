import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import type { DefaultChatTransport, UIMessage } from "ai";
import { searchCorpus } from "@/lib/workspace.functions";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ResultCard, ResultSkeleton, type CorpusHit } from "./ResultCard";
import { ProposalCard, type ProposalPayload } from "./ProposalCard";
import type { PinDraft } from "./PinDialog";
import { Search, MessageSquare, Maximize2, Minimize2, X, Square } from "lucide-react";

type Mode = "dock" | "modal";
type Tab = "assistant" | "search";

type Props = {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  mode: Mode;
  initialTab?: Tab;
  onModeChange: (m: Mode) => void;
  onAddToNotes: (hit: CorpusHit) => void;
  onPin: (draft: PinDraft) => void;
  onAddQuestion: (text: string) => Promise<void> | void;
  seedPrompt?: string;
};

export function RightRail(props: Props) {
  const { mode, onModeChange } = props;
  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "color-mix(in oklab, var(--ink) 50%, transparent)" }}>
        <button type="button" aria-label="Close" onClick={() => onModeChange("dock")} className="absolute inset-0" />
        <div
          className="relative z-10 flex h-[80vh] w-full max-w-3xl flex-col rounded-lg border shadow-2xl"
          style={{ background: "var(--paper)", borderColor: "var(--brass, #c8a24b)" }}
        >
          <RailInner {...props} />
        </div>
      </div>
    );
  }
  return (
    <aside className="hidden h-full w-[380px] shrink-0 flex-col border-l lg:flex" style={{ borderColor: "var(--rule-card)", background: "var(--paper-tint)" }}>
      <RailInner {...props} />
    </aside>
  );
}

function RailInner({
  threadId, transport, initialMessages, mode, initialTab = "assistant", onModeChange, onAddToNotes, onPin, onAddQuestion, seedPrompt,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const chat = useChat({ id: threadId, messages: initialMessages, transport });
  const seededRef = useState({ done: false })[0];
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const dismiss = (id: string) => setDismissed((s) => new Set(s).add(id));
  const markAccepted = (id: string) => setAccepted((s) => new Set(s).add(id));

  const runSuggestedSearch = (q: string, source?: string) => {
    setTab("search");
    window.dispatchEvent(new CustomEvent("workspace:run-search", { detail: { q, source } }));
  };
  useEffect(() => {
    if (seedPrompt && !seededRef.done && chat.messages.length === 0) {
      seededRef.done = true;
      void chat.sendMessage({ text: seedPrompt });
    }
  }, [seedPrompt, chat, seededRef]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header / tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2" style={{ borderColor: "var(--rule-card)" }}>
        <RailTab active={tab === "assistant"} onClick={() => setTab("assistant")} icon={<MessageSquare className="h-3.5 w-3.5" />}>Assistant</RailTab>
        <RailTab active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="h-3.5 w-3.5" />}>Search</RailTab>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange(mode === "dock" ? "modal" : "dock")}
            className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-foreground/5"
            title={mode === "dock" ? "Expand" : "Dock"}
          >
            {mode === "dock" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          {mode === "modal" && (
            <button type="button" onClick={() => onModeChange("dock")} className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-foreground/5" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "assistant" ? (
          <AssistantPane
            chat={chat}
            dismissed={dismissed}
            accepted={accepted}
            onDismiss={dismiss}
            onRunSearch={(q, source, id) => { markAccepted(id); runSuggestedSearch(q, source); }}
            onOpenPin={(draft, id) => { markAccepted(id); onPin(draft); }}
            onAddQuestion={async (text, id) => { markAccepted(id); await onAddQuestion(text); }}
          />
        ) : (
          <SearchPane onAddToNotes={onAddToNotes} onPin={(hit) => onPin(corpusHitToDraft(hit))} onSummarize={(hit) => {
            setTab("assistant");
            const text = `Summarize ${hit.source.toUpperCase()} ${hit.sectionLabel || hit.identifier} (${hit.heading}) in plain English, then give the operative quote and a one-line "use it when…" note.`;
            void chat.sendMessage({ text });
          }} />
        )}
      </div>
    </div>
  );
}

function corpusHitToDraft(hit: CorpusHit): PinDraft {
  return {
    identifier: hit.identifier,
    citation: `${hit.source.toUpperCase()} ${hit.sectionLabel || hit.identifier}`,
    heading: hit.heading,
    stance: "support",
    quote: hit.snippet,
    pinCite: "",
    userNote: "",
  };
}

function RailTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors"
      style={{
        fontFamily: "var(--font-mono)",
        color: active ? "var(--ink)" : "var(--ink-muted)",
        background: active ? "color-mix(in oklab, var(--brass, #c8a24b) 18%, transparent)" : "transparent",
        borderBottom: active ? "1px solid var(--brass, #c8a24b)" : "1px solid transparent",
      }}
    >
      {icon}{children}
    </button>
  );
}

// ── Assistant ─────────────────────────────────────────────────────────────
function AssistantPane({
  chat, dismissed, accepted, onDismiss, onRunSearch, onOpenPin, onAddQuestion,
}: {
  chat: UseChatHelpers<UIMessage>;
  dismissed: Set<string>;
  accepted: Set<string>;
  onDismiss: (id: string) => void;
  onRunSearch: (q: string, source: string | undefined, id: string) => void;
  onOpenPin: (draft: PinDraft, id: string) => void;
  onAddQuestion: (text: string, id: string) => Promise<void> | void;
}) {
  const { messages, sendMessage, status, error, stop } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-10 text-center">
              <div className="mb-2 text-[10px] tracking-[0.3em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                RESEARCH ASSISTANT
              </div>
              <h3 className="mb-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>Ask the corpus.</h3>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                The assistant proposes; you decide. Ask it to find authority for an argument, flag what cuts against you, or suggest searches to run.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") return <MessageResponse key={i}>{part.text}</MessageResponse>;
                  if (part.type?.startsWith("tool-")) {
                    const tp = part as { type: string; toolCallId?: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
                    const toolName = tp.type.replace(/^tool-/, "");
                    // Render proposal tools as interactive cards.
                    if (toolName.startsWith("propose_") && tp.output && typeof tp.output === "object") {
                      const id = tp.toolCallId ?? `${m.id}-${i}`;
                      const payload = tp.output as ProposalPayload;
                      return (
                        <ProposalCard
                          key={id}
                          payload={payload}
                          dismissed={dismissed.has(id)}
                          accepted={accepted.has(id)}
                          onDismiss={() => onDismiss(id)}
                          onRunSearch={(q, source) => onRunSearch(q, source, id)}
                          onOpenPin={(draft) => onOpenPin(draft, id)}
                          onAddQuestion={(text) => onAddQuestion(text, id)}
                        />
                      );
                    }
                    return (
                      <Tool key={tp.toolCallId ?? i} defaultOpen={false}>
                        <ToolHeader type={toolName as `tool-${string}`} state={(tp.state ?? "input-available") as "input-streaming" | "input-available" | "output-available" | "output-error"} />
                        <ToolContent>
                          {tp.input != null && <ToolInput input={tp.input} />}
                          {(tp.output != null || tp.errorText) && (
                            <ToolOutput output={tp.output as React.ReactNode} errorText={tp.errorText} />
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <div className="px-4 py-2"><Shimmer>Thinking…</Shimmer></div>
          )}
          {error && (
            <div className="mx-3 my-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error.message}</div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t p-2" style={{ borderColor: "var(--rule-card)" }}>
        <PromptInput
          onSubmit={async (msg) => {
            const text = msg.text?.trim();
            if (!text) return;
            await sendMessage({ text });
          }}
        >
          <PromptInputTextarea placeholder="Ask the assistant…" />
          <PromptInputFooter className="justify-end">
            {isLoading && (
              <button type="button" onClick={() => stop()} className="mr-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-foreground/5" style={{ borderColor: "var(--rule-card)" }}>
                <Square className="h-3 w-3 fill-current" /> Stop
              </button>
            )}
            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────
const SOURCES = [
  { id: null, label: "ALL" },
  { id: "usc", label: "USC" },
  { id: "cfr", label: "CFR" },
  { id: "const", label: "CONST" },
] as const;

function SearchPane({ onAddToNotes, onSummarize, onPin }: { onAddToNotes: (h: CorpusHit) => void; onSummarize: (h: CorpusHit) => void; onPin: (h: CorpusHit) => void }) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [hits, setHits] = useState<CorpusHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useServerFn(searchCorpus);

  const submit = async (override?: { q?: string; source?: string | null }) => {
    const query = (override?.q ?? q).trim();
    if (query.length < 2) return;
    if (override?.q !== undefined) setQ(override.q);
    if (override?.source !== undefined) setSource(override.source);
    const useSource = override?.source !== undefined ? override.source : source;
    setLoading(true); setErr(null);
    try {
      const rows = await run({ data: { q: query, source: useSource, limit: 15 } });
      setHits(rows as CorpusHit[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  // Listen for AI-proposed searches the user accepted
  useEffect(() => {
    const onRun = (e: Event) => {
      const detail = (e as CustomEvent<{ q: string; source?: string }>).detail;
      void submit({ q: detail.q, source: detail.source ?? null });
    };
    window.addEventListener("workspace:run-search", onRun);
    return () => window.removeEventListener("workspace:run-search", onRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b p-3" style={{ borderColor: "var(--rule-card)" }}>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the corpus or paste a citation…"
              className="w-full rounded-md border bg-card py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-foreground/30"
              style={{ borderColor: "var(--rule-card)" }}
            />
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-1">
          {SOURCES.map((s) => {
            const active = source === s.id;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setSource(s.id)}
                className="rounded-full border px-2 py-0.5 text-[10px] tracking-[0.18em] transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  borderColor: active ? "var(--brass, #c8a24b)" : "var(--rule-card)",
                  background: active ? "color-mix(in oklab, var(--brass, #c8a24b) 18%, transparent)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-muted)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="space-y-2"><ResultSkeleton /><ResultSkeleton /><ResultSkeleton /></div>
        )}
        {!loading && err && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
        {!loading && hits && hits.length === 0 && !err && (
          <div className="px-2 py-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>No hits. Try fewer words.</div>
        )}
        {!loading && hits === null && (
          <div className="px-2 py-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
            Type a phrase like <span style={{ fontFamily: "var(--font-mono)" }}>"qualified immunity"</span> or a citation like <span style={{ fontFamily: "var(--font-mono)" }}>42 USC 1983</span>.
          </div>
        )}
        {!loading && hits && hits.length > 0 && (
          <div className="space-y-2">
            {hits.map((h) => (
              <ResultCard key={h.identifier} hit={h} onAddToNotes={onAddToNotes} onSummarize={onSummarize} onPin={onPin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Effect to keep tab in sync if prop changes — not used yet but reserved. */
export function _noop() { useEffect(() => {}, []); }