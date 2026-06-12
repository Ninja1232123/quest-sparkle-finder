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
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/workspace/$threadId")({
  component: WorkspaceThreadPage,
});

type Doc = { id: string; kind: string; title: string; created_at: string };

function WorkspaceThreadPage() {
  const { threadId } = Route.useParams();
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
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  docs: Doc[];
  setDocs: (d: Doc[]) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  loadDocs: (args: { data: { threadId: string } }) => Promise<unknown>;
}) {
  const { messages, sendMessage, status, error } = useChat({
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

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="mx-auto max-w-xl py-10 text-center">
                <div className="mb-2 text-xs tracking-[0.3em]" style={{ color: "rgba(0,0,0,0.45)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
                  AI LEGAL WORKSPACE
                </div>
                <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>
                  Ask. Research. Draft. Cite-check.
                </h2>
                <p className="text-sm text-muted-foreground">
                  Try: "Draft a § 1983 complaint outline for excessive force," or "What does 42 USC 1983 actually say?"
                </p>
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
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={isLoading} />
            </PromptInputFooter>
          </PromptInput>
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