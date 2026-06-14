import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { DefaultChatTransport, UIMessage } from "ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ProposalCard, type ProposalPayload } from "@/components/workspace/ProposalCard";
import type { PinDraft } from "@/components/workspace/PinDialog";
import { Square } from "lucide-react";
import { Panel, Surface } from "./Panel";

export function ModelContainer({
  threadId,
  transport,
  initialMessages,
  seedPrompt,
  onPin,
  onAddQuestion,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  seedPrompt?: string;
  onPin: (draft: PinDraft) => void;
  onAddQuestion: (text: string) => Promise<void> | void;
}) {
  const chat = useChat({ id: threadId, messages: initialMessages, transport });
  const { messages, sendMessage, status, error, stop } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const seeded = useState({ done: false })[0];
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const mark = (set: typeof setAccepted) => (id: string) => set((s) => new Set(s).add(id));

  const runSearch = (q: string, source?: string) =>
    window.dispatchEvent(new CustomEvent("workspace:run-search", { detail: { q, source } }));

  useEffect(() => {
    if (seedPrompt && !seeded.done && chat.messages.length === 0) {
      seeded.done = true;
      void chat.sendMessage({ text: seedPrompt });
    }
  }, [seedPrompt, chat, seeded]);

  return (
    <Panel
      label="Assistant"
      bodyClassName="p-2"
      footer={
        <PromptInput
          onSubmit={async (msg) => {
            const text = msg.text?.trim();
            if (text) await sendMessage({ text });
          }}
        >
          <div className="rounded-lg" style={{ background: "#fff", boxShadow: "inset 0 0 0 1.5px rgba(200,162,75,0.4)" }}>
            <PromptInputTextarea placeholder="Ask the assistant — it proposes, you decide…" />
            <PromptInputFooter className="justify-end px-2 pb-1.5">
              {isLoading && (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="mr-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-foreground/5"
                  style={{ borderColor: "var(--rule-card)" }}
                >
                  <Square className="h-3 w-3 fill-current" /> Stop
                </button>
              )}
              <PromptInputSubmit status={status} disabled={isLoading} />
            </PromptInputFooter>
          </div>
        </PromptInput>
      }
    >
      <Surface className="h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="px-4 py-7">
                <div className="mb-1 text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  Research assistant
                </div>
                <p className="mb-1 text-[15px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                  It proposes.<br />You decide.
                </p>
                <p className="mb-4 text-[11px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  Ask it to find authority, flag what cuts against you, or pull the case that controls. Nothing touches your draft without a tap.
                </p>
                <div className="space-y-1.5">
                  {STARTERS.map((p) => (
                    <button
                      key={p.text}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void sendMessage({ text: p.text })}
                      className="w-full rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-all hover:-translate-y-px hover:shadow-sm disabled:opacity-50"
                      style={{ borderColor: "var(--rule-card)", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-serif)" }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
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
                      if (toolName.startsWith("propose_") && tp.output && typeof tp.output === "object") {
                        const id = tp.toolCallId ?? `${m.id}-${i}`;
                        return (
                          <ProposalCard
                            key={id}
                            payload={tp.output as ProposalPayload}
                            dismissed={dismissed.has(id)}
                            accepted={accepted.has(id)}
                            onDismiss={() => mark(setDismissed)(id)}
                            onRunSearch={(q, source) => { mark(setAccepted)(id); runSearch(q, source); }}
                            onOpenPin={(draft) => { mark(setAccepted)(id); onPin(draft); }}
                            onAddQuestion={(text) => { mark(setAccepted)(id); void onAddQuestion(text); }}
                          />
                        );
                      }
                      return (
                        <Tool key={tp.toolCallId ?? i} defaultOpen={false}>
                          <ToolHeader type={toolName as `tool-${string}`} state={(tp.state ?? "input-available") as "input-streaming" | "input-available" | "output-available" | "output-error"} />
                          <ToolContent>
                            {tp.input != null && <ToolInput input={tp.input} />}
                            {(tp.output != null || tp.errorText) && <ToolOutput output={tp.output as React.ReactNode} errorText={tp.errorText} />}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && <div className="px-4 py-2"><Shimmer>Thinking…</Shimmer></div>}
            {error && <div className="mx-3 my-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error.message}</div>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </Surface>
    </Panel>
  );
}

const STARTERS = [
  { label: "What are the elements I have to prove?", text: "What are the legal elements I need to establish for this claim? List each one and tell me what law supports it." },
  { label: "What will the other side argue?", text: "What are the strongest arguments the opposing party will raise against my complaint? Include threshold defenses like standing, limitations, or Twombly/Iqbal plausibility." },
  { label: "What's missing before I can file?", text: "Look at the authorities and questions on my issues board. What's still missing before this complaint is ready to file?" },
] as const;
