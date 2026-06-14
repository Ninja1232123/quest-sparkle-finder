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
  headerRight,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  seedPrompt?: string;
  onPin: (draft: PinDraft) => void;
  onAddQuestion: (text: string) => Promise<void> | void;
  headerRight?: React.ReactNode;
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
      headerRight={headerRight}
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
                <div className="mb-1 text-[10.5px] tracking-[0.3em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  Research assistant
                </div>
                <p className="mb-1 text-[15px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                  It proposes.<br />You decide.
                </p>
                <p className="mb-4 text-[11px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  Ask it to find authority, flag what cuts against you, or pull the case that controls. Nothing touches your draft without a tap.
                </p>
                <IntakeForm disabled={isLoading} onSubmit={(text) => void sendMessage({ text })} />
                <div className="mb-1.5 text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  …or jump in
                </div>
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

// Five-field intake → a structured opening message that lets the assistant run a
// meaningful first sweep with no back-and-forth. Everything else gets discovered.
function IntakeForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (text: string) => void }) {
  const [parties, setParties] = useState("");
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [side, setSide] = useState("");
  const [relief, setRelief] = useState("");
  const [open, setOpen] = useState(true);

  const ready = what.trim().length > 3;
  const submit = () => {
    if (!ready || disabled) return;
    const lines = [
      parties.trim() && `- Parties: ${parties.trim()}`,
      `- What happened: ${what.trim()}`,
      where.trim() && `- Jurisdiction: ${where.trim()}`,
      side && `- I am the: ${side}`,
      relief.trim() && `- Relief I want: ${relief.trim()}`,
    ].filter(Boolean).join("\n");
    onSubmit(
      `Here's my case — run an opening sweep so we can start building the board:\n${lines}\n\n` +
        `Sweep statutes and cases (federal + the state above) for the claims and defenses this raises. ` +
        `Propose authorities to pin, flag anything adverse, and log the open questions. I'll decide what actually goes on the board.`,
    );
  };

  const field = "w-full rounded-md px-2 py-1.5 text-[12px] outline-none";
  const fieldStyle = { background: "var(--paper)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--rule-card)" } as const;
  const labelCls = "mb-0.5 block text-[10px] font-semibold tracking-[0.12em] uppercase";
  const labelStyle = { color: "var(--ink-muted)", fontFamily: "var(--font-mono)" } as const;

  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "var(--rule-card)", background: "color-mix(in oklab, var(--paper) 70%, transparent)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mb-1 flex w-full items-center justify-between text-left">
        <span className="text-[12px] font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          Start with the basics →
        </span>
        <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Five quick fields and I'll run a real opening sweep — no back-and-forth. Only the one-sentence summary is required.
          </p>
          <div>
            <label className={labelCls} style={labelStyle}>Who are the parties</label>
            <input className={field} style={fieldStyle} value={parties} onChange={(e) => setParties(e.target.value)} placeholder="e.g. me vs. Acme Collections LLC" disabled={disabled} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>What happened, in one sentence *</label>
            <textarea className={field} style={fieldStyle} rows={2} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. a collector kept calling after I disputed a debt that isn't mine" disabled={disabled} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls} style={labelStyle}>State / jurisdiction</label>
              <input className={field} style={fieldStyle} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. California" disabled={disabled} />
            </div>
            <div className="flex-1">
              <label className={labelCls} style={labelStyle}>Your side</label>
              <select className={field} style={fieldStyle} value={side} onChange={(e) => setSide(e.target.value)} disabled={disabled}>
                <option value="">—</option>
                <option value="Plaintiff">Plaintiff</option>
                <option value="Defendant">Defendant</option>
                <option value="Not sure yet">Not sure yet</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Relief you want</label>
            <input className={field} style={fieldStyle} value={relief} onChange={(e) => setRelief(e.target.value)} placeholder="e.g. damages and an injunction to stop the calls" disabled={disabled} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || disabled}
            className="w-full rounded-lg py-2 text-[12px] font-bold tracking-wide transition-transform hover:-translate-y-px disabled:opacity-50"
            style={{ background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--font-serif)" }}
          >
            Run my opening sweep →
          </button>
        </div>
      )}
    </div>
  );
}

const STARTERS = [
  { label: "What are the elements I have to prove?", text: "What are the legal elements I need to establish for this claim? List each one and tell me what law supports it." },
  { label: "What will the other side argue?", text: "What are the strongest arguments the opposing party will raise against my complaint? Include threshold defenses like standing, limitations, or Twombly/Iqbal plausibility." },
  { label: "What's missing before I can file?", text: "Look at the authorities and questions on my issues board. What's still missing before this complaint is ready to file?" },
] as const;
