import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getThreadMessages, listThreadDocuments } from "@/lib/workspace.functions";
import { supabaseAuth } from "@/integrations/supabase/auth-client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { FileText, Download, Square, FileSignature, Search, FileCheck2, ScrollText } from "lucide-react";
import { LegalDisclaimer } from "@/components/marginalia/LegalDisclaimer";

export const Route = createFileRoute("/workspace/$threadId")({
  component: WorkspaceThreadPage,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
});

type Doc = { id: string; kind: string; title: string; created_at: string };

const QUICK_PROMPTS = [
  { icon: FileSignature, label: "Draft a motion to dismiss under FRCP 12(b)(6)" },
  { icon: Search, label: "Find the elements of a § 1983 claim" },
  { icon: FileCheck2, label: "Cite-check this paragraph" },
  { icon: ScrollText, label: "Plain-English the residential lead-paint rule" },
];

function WorkspaceThreadPage() {
  const { threadId } = Route.useParams();
  const { q: seedPrompt } = Route.useSearch();
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const loadMessages = useServerFn(getThreadMessages);
  const loadDocs = useServerFn(listThreadDocuments);

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    setInitialMessages(null);
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
    loadDocs({ data: { threadId } }).then((d) => setDocs(d as Doc[])).catch(() => setDocs([]));
  }, [threadId, loadMessages, loadDocs]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/workspace/chat",
        headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
        body: { threadId },
      }),
    [threadId, token],
  );

  return initialMessages === null || token === null ? (
    <div className="flex h-full items-center justify-center text-muted-foreground">Loading session…</div>
  ) : (
    <ThreadChat
      key={threadId}
      threadId={threadId}
      transport={transport}
      initialMessages={initialMessages}
      docs={docs}
      setDocs={setDocs}
      textareaRef={textareaRef}
      loadDocs={loadDocs}
      seedPrompt={seedPrompt}
    />
  );
}

function ThreadChat({
  threadId,
  transport,
  initialMessages,
  docs,
  setDocs,
  textareaRef,
  loadDocs,
  seedPrompt,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  docs: Doc[];
  setDocs: (d: Doc[]) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  loadDocs: (args: { data: { threadId: string } }) => Promise<unknown>;
  seedPrompt?: string;
}) {
  const { messages, sendMessage, status, error, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status, textareaRef]);

  // Refresh docs when a draft tool completes
  useEffect(() => {
    if (status !== "ready") return;
    loadDocs({ data: { threadId } }).then((d) => setDocs(d as Doc[])).catch(() => {});
  }, [status, threadId, loadDocs, setDocs]);

  // Pre-fill composer when navigated with ?q=…
  useEffect(() => {
    if (seedPrompt && textareaRef.current) {
      textareaRef.current.value = seedPrompt;
      textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      textareaRef.current.focus();
    }
  }, [seedPrompt, textareaRef]);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="mx-auto max-w-2xl py-12">
                <div className="mb-2 text-center text-xs tracking-[0.3em]" style={{ color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
                  AI LEGAL WORKSPACE
                </div>
                <h2 className="mb-3 text-center text-3xl" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>
                  Ask. Research. Draft. Cite-check.
                </h2>
                <p className="text-center text-sm text-muted-foreground">
                  The model reads the corpus before it speaks. Pick a starter or just type.
                </p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => void sendMessage({ text: p.label })}
                      className="group flex items-start gap-2 rounded-lg border bg-background/60 p-3 text-left text-xs transition-all hover:border-foreground/40 hover:shadow-sm"
                      style={{ borderColor: "rgba(0,0,0,0.12)" }}
                    >
                      <p.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="leading-snug">{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <LegalDisclaimer variant="inline" />
                </div>
              </div>
            )}
            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    if (part.type?.startsWith("tool-")) {
                      const tp = part as {
                        type: string;
                        toolCallId?: string;
                        state?: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      const toolName = tp.type.replace(/^tool-/, "");
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
              <div className="px-4 py-2">
                <Shimmer>Thinking…</Shimmer>
              </div>
            )}
            {error && (
              <div className="mx-4 my-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error.message}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <PromptInput
            onSubmit={async (msg) => {
              const text = msg.text?.trim();
              if (!text) return;
              await sendMessage({ text });
            }}
          >
            <PromptInputTextarea ref={textareaRef} placeholder="Ask the workspace… (e.g. 'draft a motion to dismiss under FRCP 12(b)(6)')" />
            <PromptInputFooter className="justify-between">
              <div className="text-[10px] tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono, 'Special Elite')" }}>
                ⏎ send · ⇧⏎ newline
              </div>
              <div className="flex items-center gap-2">
                {isLoading && (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-foreground/5"
                    style={{ borderColor: "rgba(0,0,0,0.15)" }}
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop
                  </button>
                )}
                <PromptInputSubmit status={status} disabled={isLoading} />
              </div>
            </PromptInputFooter>
          </PromptInput>
          <LegalDisclaimer variant="compact" className="mt-2 text-center" />
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l p-3 lg:block" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" }}>
        <div className="mb-2 text-[10px] tracking-[0.25em]" style={{ color: "rgba(0,0,0,0.5)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
          ARTIFACTS
        </div>
        {docs.length === 0 ? (
          <div className="text-xs text-muted-foreground">No drafts yet. Ask the model to draft something.</div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="rounded-md border bg-background p-2 text-sm">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>{d.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.kind}</div>
                  </div>
                  <a
                    href={`/workspace/doc/${d.id}?format=md`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1 hover:bg-accent"
                    aria-label="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}