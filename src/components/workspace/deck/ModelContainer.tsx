import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { DefaultChatTransport, UIMessage } from "ai";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getScratchpad, setScratchpad as saveScratchpad } from "@/lib/workspace.functions";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ProposalCard, type ProposalPayload } from "@/components/workspace/ProposalCard";
import type { PinDraft } from "@/components/workspace/PinDialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { getJuriCredits } from "@/lib/juri.functions";
import { CREDIT_PACKS, centsPerCredit, type CreditPack } from "@/lib/juri-credits";
import { Square, FileSignature, CornerDownLeft, Coins, Check, X, NotebookPen, ChevronDown, ChevronUp, Search, FileText, Pin, Network, History as HistoryIcon, Sparkles, BookOpen } from "lucide-react";
import { Panel, Surface } from "./Panel";

type Mode = "research" | "draft";

export function ModelContainer({
  threadId,
  transport,
  initialMessages,
  seedPrompt,
  onPin,
  onAddQuestion,
  onAddToDraft,
  headerRight,
}: {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  seedPrompt?: string;
  onPin: (draft: PinDraft) => void;
  onAddQuestion: (text: string) => Promise<void> | void;
  onAddToDraft?: (markdown: string) => void;
  headerRight?: React.ReactNode;
}) {
  const chat = useChat({ id: threadId, messages: initialMessages, transport });
  const { messages, sendMessage, status, error, stop } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const seeded = useState({ done: false })[0];
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("research");
  const mark = (set: typeof setAccepted) => (id: string) => set((s) => new Set(s).add(id));
  const router = useRouter();

  // ── Credits — same wallet as Juri. Refresh on mount and whenever a turn
  // finishes (the server deducts after each streamText onFinish).
  const [credits, setCredits] = useState<number | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const refreshCredits = () => { void getJuriCredits().then((r) => setCredits(r.credits)).catch(() => {}); };
  useEffect(() => { refreshCredits(); }, []);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") refreshCredits();
    prevStatus.current = status;
  }, [status]);

  // ── Shared workspace UI: when the model finishes a tool call, light up the
  // user's own surfaces (search panel, reader) so they see exactly what it saw.
  // We track which tool-call IDs we've already broadcast so re-renders don't
  // re-dispatch them.
  const broadcast = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (let i = 0; i < m.parts.length; i++) {
        const p = m.parts[i] as { type?: string; toolCallId?: string; state?: string; input?: unknown; output?: unknown };
        if (!p.type?.startsWith("tool-")) continue;
        if (p.state !== "output-available") continue;
        const key = p.toolCallId ?? `${m.id}-${i}`;
        if (broadcast.current.has(key)) continue;
        broadcast.current.add(key);
        const name = p.type.replace(/^tool-/, "");
        const input = (p.input ?? {}) as Record<string, unknown>;
        const output = (p.output ?? {}) as Record<string, unknown>;
        if (name === "fetch_document" && typeof output.identifier === "string") {
          window.dispatchEvent(new CustomEvent("workspace:open-doc", { detail: { ref: output.identifier } }));
        } else if (name === "fetch_case" && typeof output.id === "string") {
          window.dispatchEvent(new CustomEvent("workspace:open-doc", { detail: { ref: output.id } }));
        } else if (
          (name === "search_corpus" || name === "scan_corpus" || name === "search_boolean" ||
           name === "precise_search" || name === "open_basin") &&
          Array.isArray(output.results)
        ) {
          window.dispatchEvent(new CustomEvent("workspace:show-results", {
            detail: {
              kind: "statute",
              query: typeof input.q === "string" ? input.q : null,
              source: typeof input.source === "string" ? input.source : null,
              rows: output.results,
              fromAssistant: true,
            },
          }));
        } else if (name === "search_cases" && Array.isArray(output.results)) {
          window.dispatchEvent(new CustomEvent("workspace:show-results", {
            detail: {
              kind: "case",
              query: typeof input.q === "string" ? input.q : null,
              rows: output.results,
              fromAssistant: true,
            },
          }));
        } else if (name === "propose_draft_edit" && typeof output === "object") {
          window.dispatchEvent(new CustomEvent("workspace:propose-edit", {
            detail: {
              id: key,
              kind: (output as { kind?: string }).kind,
              anchor: (output as { anchor?: string }).anchor ?? null,
              markdown: (output as { markdown?: string }).markdown ?? "",
              why: (output as { why?: string }).why ?? "",
            },
          }));
        }
      }
    }
  }, [messages]);

  // Every send carries the current mode (or an override) so the server knows
  // whether to research-and-propose or draft strictly from the board.
  const send = (text: string, modeOverride?: Mode) =>
    sendMessage({ text }, { body: { mode: modeOverride ?? mode } });

  const runSearch = (q: string, source?: string) =>
    window.dispatchEvent(new CustomEvent("workspace:run-search", { detail: { q, source } }));

  useEffect(() => {
    if (seedPrompt && !seeded.done && chat.messages.length === 0) {
      seeded.done = true;
      void chat.sendMessage({ text: seedPrompt }, { body: { mode: "research" } });
    }
  }, [seedPrompt, chat, seeded]);

  // Board-driven actions (e.g. the "Break my theory" pressure-test) dispatch a
  // prompt here so the chat owns the send. They always run in research mode.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (text) void send(text, "research");
    };
    window.addEventListener("workspace:ask", onAsk);
    return () => window.removeEventListener("workspace:ask", onAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Activity strip: the last tool the assistant ran this session. Keeps the
  // user aware of what context the model is operating on without forcing them
  // to crack open every collapsed tool card.
  const lastActivity = useMemo(() => {
    for (let mi = messages.length - 1; mi >= 0; mi--) {
      const m = messages[mi];
      if (m.role !== "assistant") continue;
      for (let pi = m.parts.length - 1; pi >= 0; pi--) {
        const p = m.parts[pi] as { type?: string; state?: string; input?: unknown; output?: unknown };
        if (!p.type?.startsWith("tool-")) continue;
        const name = p.type.replace(/^tool-/, "");
        const input = (p.input ?? {}) as Record<string, unknown>;
        const output = (p.output ?? {}) as Record<string, unknown>;
        return { name, state: p.state ?? "input-available", input, output };
      }
    }
    return null;
  }, [messages]);

  // ── Scratchpad surfacing: read the model's rolling memory, let the user edit
  // or wipe it. Refetch on mount + every time a turn lands so they see what it
  // wrote down. Saving is debounced via an explicit button to avoid stomping
  // mid-turn writes from the model.
  const loadPad = useServerFn(getScratchpad);
  const savePad = useServerFn(saveScratchpad);
  const [padOpen, setPadOpen] = useState(false);
  const [pad, setPad] = useState<string>("");
  const [padDirty, setPadDirty] = useState(false);
  const [padSaving, setPadSaving] = useState(false);
  const padFetched = useRef(false);
  const refreshPad = () => {
    void loadPad({ data: { threadId } })
      .then((r) => {
        const next = (r as { scratchpad?: string }).scratchpad ?? "";
        // Don't clobber unsaved edits the user is typing.
        if (!padDirty) setPad(next);
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (padFetched.current) return;
    padFetched.current = true;
    refreshPad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") refreshPad();
    // prevStatus is also updated in the credits effect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const savePadNow = async () => {
    setPadSaving(true);
    try {
      await savePad({ data: { threadId, content: pad } });
      setPadDirty(false);
    } finally {
      setPadSaving(false);
    }
  };

  return (
    <Panel
      label={mode === "draft" ? "Assistant · Drafting" : "Assistant"}
      accent={mode === "draft" ? "#7bb651" : undefined}
      bodyClassName="p-2"
      headerRight={
        <>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "draft" ? "research" : "draft"))}
            title={mode === "draft"
              ? "Drafting mode: the assistant writes only from your pinned authorities. Tap to return to research."
              : "Switch to constrained drafting — every sentence must trace to a pinned card."}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors"
            style={{
              borderColor: mode === "draft" ? "#7bb651" : "rgba(200,162,75,0.4)",
              color: mode === "draft" ? "#0c1b3d" : "#c8a24b",
              background: mode === "draft" ? "#7bb651" : "transparent",
              fontFamily: "var(--font-mono, 'Special Elite')",
            }}
          >
            <FileSignature className="h-3 w-3" /> {mode === "draft" ? "Drafting" : "Draft"}
          </button>
          <CreditsTopUp credits={credits} open={showBuy} onOpenChange={setShowBuy} returnPath={router.state.location.pathname} />
          {headerRight}
        </>
      }
      footer={
        <PromptInput
          className="overflow-hidden rounded-lg [&>[data-slot=input-group]]:!rounded-lg [&>[data-slot=input-group]]:!border-0 [&>[data-slot=input-group]]:!bg-white"
          style={{ boxShadow: `inset 0 0 0 1.5px ${mode === "draft" ? "rgba(123,182,81,0.55)" : "rgba(200,162,75,0.4)"}` }}
          onSubmit={async (msg) => {
            const text = msg.text?.trim();
            if (text) await send(text);
          }}
        >
          <PromptInputTextarea
            className="min-h-[46px] bg-transparent text-[14px] leading-relaxed placeholder:text-[rgba(12,27,61,0.45)]"
            style={{ color: "var(--ink, #0c1b3d)" }}
            placeholder={mode === "draft" ? "Tell me what section to draft — I'll build it only from your pins…" : "Ask the assistant — it proposes, you decide…"}
          />
          <PromptInputFooter className="justify-end px-2 pb-1.5">
            {isLoading && (
              <button
                type="button"
                onClick={() => stop()}
                className="mr-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[13px] hover:bg-foreground/5"
                style={{ borderColor: "var(--rule-card)", color: "var(--ink, #0c1b3d)" }}
              >
                <Square className="h-3.5 w-3.5 fill-current" /> Stop
              </button>
            )}
            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <ActivityStrip activity={lastActivity} loading={isLoading} onOpenPad={() => setPadOpen((v) => !v)} padOpen={padOpen} padWordCount={pad.trim() ? pad.trim().split(/\s+/).length : 0} />
        {padOpen && (
          <ScratchpadDrawer
            value={pad}
            saving={padSaving}
            dirty={padDirty}
            onChange={(v) => { setPad(v); setPadDirty(true); }}
            onSave={savePadNow}
            onClose={() => setPadOpen(false)}
          />
        )}
        <Surface className="min-h-0 flex-1">
          <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="px-4 py-7">
                <div className="mb-1 text-[12px] tracking-[0.3em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  Research assistant
                </div>
                <p className="mb-1 text-[17px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                  It proposes.<br />You decide.
                </p>
                <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  Ask it to find authority, flag what cuts against you, or pull the case that controls. Nothing touches your draft without a tap.
                </p>
                <IntakeForm disabled={isLoading} onSubmit={(text) => void send(text, "research")} />
                <div className="mb-1.5 text-[12px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                  …or jump in
                </div>
                <div className="space-y-1.5">
                  {STARTERS.map((p) => (
                    <button
                      key={p.text}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void send(p.text, "research")}
                      className="w-full rounded-lg border px-3 py-2 text-left text-[14px] font-medium transition-all hover:-translate-y-px hover:shadow-sm disabled:opacity-50"
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
                    if (part.type === "text") {
                      return (
                        <div key={i}>
                          <MessageResponse>{part.text}</MessageResponse>
                          {m.role === "assistant" && onAddToDraft && part.text.trim() && (
                            <button
                              type="button"
                              onClick={() => onAddToDraft(part.text)}
                              title="Insert this into your draft"
                              className="mt-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[12px] font-semibold tracking-wider uppercase opacity-60 transition hover:opacity-100"
                              style={{ borderColor: "var(--rule-card)", color: "var(--ink-muted)" }}
                            >
                              <CornerDownLeft className="h-3 w-3" /> Insert into draft
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (part.type?.startsWith("tool-")) {
                      const tp = part as { type: string; toolCallId?: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
                      const toolName = tp.type.replace(/^tool-/, "");
                      // The draft-edit proposal is surfaced inline in the editor,
                      // not as a chat card — leave a tight breadcrumb here.
                      if (toolName === "propose_draft_edit" && tp.output && typeof tp.output === "object") {
                        const o = tp.output as { kind?: string; why?: string };
                        return (
                          <div key={tp.toolCallId ?? i} className="my-1 rounded border px-2 py-1 text-[12px]" style={{ borderColor: "rgba(123,182,81,0.5)", background: "rgba(123,182,81,0.08)", color: "var(--ink)" }}>
                            <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                              Draft edit proposed →
                            </span>{" "}
                            <span style={{ color: "var(--ink-muted)" }}>{o.why || `${o.kind ?? "edit"} pending in your Doc Creator`}</span>
                          </div>
                        );
                      }
                      if (toolName.startsWith("propose_") && toolName !== "propose_draft_edit" && tp.output && typeof tp.output === "object") {
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
                      // Hide scratchpad updates from the transcript — it's bookkeeping.
                      if (toolName === "update_scratchpad") return null;
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
            {error && (
              error.message.startsWith("OUT_OF_CREDITS:") ? (
                <div className="mx-3 my-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900">
                  {error.message.replace("OUT_OF_CREDITS: ", "")}{" "}
                  <button type="button" onClick={() => setShowBuy(true)} className="font-semibold underline">
                    Get more credits
                  </button>.
                </div>
              ) : (
                <div className="mx-3 my-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error.message}</div>
              )
            )}
          </ConversationContent>
          <ConversationScrollButton />
          </Conversation>
        </Surface>
      </div>
    </Panel>
  );
}

// Credits pill + buy-pack popover, docked in the assistant header. Same wallet
// as Juri (juri_credits) — the server gate/metering lives in api/workspace/chat.ts.
function CreditsTopUp({
  credits,
  open,
  onOpenChange,
  returnPath,
}: {
  credits: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnPath: string;
}) {
  const [checkoutPack, setCheckoutPack] = useState<CreditPack | null>(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        title="Workspace credits — tap to top up"
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-semibold"
        style={{ borderColor: "rgba(200,162,75,0.4)", color: "#c8a24b", fontFamily: "var(--font-mono, 'Special Elite')" }}
      >
        <Coins className="h-3 w-3" /> {credits == null ? "…" : credits >= 9999 ? "∞" : credits}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { onOpenChange(false); setCheckoutPack(null); }} />
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl border p-3 shadow-lg"
            style={{ borderColor: "var(--rule-card)", background: "var(--paper)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
                {checkoutPack ? `${checkoutPack.credits} credits` : "Top up credits"}
              </span>
              <button
                type="button"
                onClick={() => { onOpenChange(false); setCheckoutPack(null); }}
                className="opacity-60 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {checkoutPack ? (
              <div>
                <div className="mb-2 text-center text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  ${(checkoutPack.priceCents / 100).toFixed(0)}
                </div>
                <StripeEmbeddedCheckout creditPackId={checkoutPack.lookupKey} returnPath={returnPath} />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  Credits never expire and bill by what the assistant actually does — deeper research spends more.
                </p>
                {CREDIT_PACKS.map((pack) => (
                  <button
                    key={pack.lookupKey}
                    type="button"
                    onClick={() => setCheckoutPack(pack)}
                    className="flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left transition hover:-translate-y-px"
                    style={{ borderColor: "var(--rule-card)", background: "color-mix(in oklab, var(--paper) 70%, transparent)" }}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>{pack.label}</span>
                        {pack.badge && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(200,162,75,0.18)", color: "#c8a24b" }}>
                            {pack.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                        {pack.credits.toLocaleString()} credits · {centsPerCredit(pack).toFixed(1)}¢ each
                      </div>
                    </div>
                    <div className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                      ${(pack.priceCents / 100).toFixed(0)}
                    </div>
                  </button>
                ))}
                <div className="flex items-center justify-center gap-1 pt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
                  <Check className="h-3 w-3" /> Secure checkout by Stripe
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
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

  const field = "w-full rounded-md px-2 py-1.5 text-[14px] outline-none";
  const fieldStyle = { background: "var(--paper)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--rule-card)" } as const;
  const labelCls = "mb-0.5 block text-[12px] font-semibold tracking-[0.12em] uppercase";
  const labelStyle = { color: "var(--ink-muted)", fontFamily: "var(--font-mono)" } as const;

  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "var(--rule-card)", background: "color-mix(in oklab, var(--paper) 70%, transparent)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mb-1 flex w-full items-center justify-between text-left">
        <span className="text-[14px] font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          Start with the basics →
        </span>
        <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
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
            className="w-full rounded-lg py-2 text-[14px] font-bold tracking-wide transition-transform hover:-translate-y-px disabled:opacity-50"
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

// ── Activity strip ─────────────────────────────────────────────────────────
// A thin, always-visible line telling the user what the assistant just did so
// the model's context is never invisible. Click it to peek at the scratchpad.
const TOOL_LABELS: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  scan_corpus: { label: "Scanned corpus", Icon: Search },
  search_corpus: { label: "Searched corpus", Icon: Search },
  search_boolean: { label: "Boolean search", Icon: Search },
  precise_search: { label: "Precision drill", Icon: Search },
  search_cases: { label: "Searched cases", Icon: BookOpen },
  fetch_document: { label: "Read statute", Icon: FileText },
  fetch_case: { label: "Read case", Icon: BookOpen },
  citations: { label: "Followed citations", Icon: Network },
  list_basins: { label: "Listed basins", Icon: Network },
  open_basin: { label: "Opened basin", Icon: Network },
  legislative_history: { label: "Legislative history", Icon: HistoryIcon },
  regulatory_history: { label: "Regulatory history", Icon: HistoryIcon },
  propose_pin: { label: "Proposed pin", Icon: Pin },
  propose_adverse: { label: "Flagged adverse", Icon: Pin },
  propose_search: { label: "Suggested search", Icon: Sparkles },
  propose_question: { label: "Logged question", Icon: Sparkles },
  propose_draft_edit: { label: "Proposed draft edit", Icon: FileSignature },
  update_scratchpad: { label: "Updated scratchpad", Icon: NotebookPen },
};

function ActivityStrip({
  activity, loading, onOpenPad, padOpen, padWordCount,
}: {
  activity: { name: string; state: string; input: Record<string, unknown>; output: Record<string, unknown> } | null;
  loading: boolean;
  onOpenPad: () => void;
  padOpen: boolean;
  padWordCount: number;
}) {
  const meta = activity ? TOOL_LABELS[activity.name] ?? { label: activity.name, Icon: Sparkles } : null;
  const Icon = meta?.Icon ?? Sparkles;
  const detail = activity ? describeActivity(activity) : null;
  const running = loading && activity?.state !== "output-available";

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-md border px-2 py-1 text-[12px]"
      style={{
        borderColor: "rgba(200,162,75,0.35)",
        background: "color-mix(in oklab, var(--paper) 65%, transparent)",
        fontFamily: "var(--font-mono, 'Special Elite')",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: running ? "#c8a24b" : activity ? "#3f7d4e" : "var(--rule-card)",
          boxShadow: running ? "0 0 6px #c8a24b" : "none",
        }}
      />
      <Icon className="h-3 w-3 shrink-0" style={{ color: "var(--ink-muted)" }} />
      <span className="truncate" style={{ color: "var(--ink)" }}>
        {activity ? (
          <>
            <span className="font-semibold">{meta!.label}</span>
            {detail && <span style={{ color: "var(--ink-muted)" }}>{" "}· {detail}</span>}
          </>
        ) : (
          <span style={{ color: "var(--ink-muted)" }}>Idle — assistant hasn't run anything this session yet.</span>
        )}
      </span>
      <button
        type="button"
        onClick={onOpenPad}
        title="The model's rolling memory — read or edit what it's carrying forward."
        className="ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-foreground/5"
        style={{ borderColor: "var(--rule-card)", color: "var(--ink-muted)" }}
      >
        <NotebookPen className="h-3 w-3" />
        Scratchpad
        {padWordCount > 0 && <span className="opacity-60">· {padWordCount}w</span>}
        {padOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
    </div>
  );
}

function describeActivity(a: { name: string; input: Record<string, unknown>; output: Record<string, unknown> }): string | null {
  const q = typeof a.input.q === "string" ? a.input.q : null;
  const id = typeof a.input.identifier === "string" ? a.input.identifier : typeof a.output.identifier === "string" ? a.output.identifier : null;
  const terms = Array.isArray(a.input.terms) ? (a.input.terms as unknown[]).filter((t) => typeof t === "string").join(" + ") : null;
  const count = typeof a.output.count === "number" ? a.output.count : Array.isArray(a.output.results) ? a.output.results.length : null;
  if (q) return count != null ? `"${truncate(q, 40)}" → ${count}` : `"${truncate(q, 50)}"`;
  if (terms) return count != null ? `${truncate(terms, 40)} → ${count}` : truncate(terms, 50);
  if (id) return truncate(id, 50);
  if (a.name === "update_scratchpad" && typeof a.input.content === "string") {
    const len = (a.input.content as string).trim().split(/\s+/).length;
    return `${len} words saved`;
  }
  return null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ── Scratchpad drawer ─────────────────────────────────────────────────────
// The model's long-term memory across this session. Surfaced so the user can
// read what the assistant is carrying forward and correct it if it's drifted.
function ScratchpadDrawer({
  value, saving, dirty, onChange, onSave, onClose,
}: {
  value: string;
  saving: boolean;
  dirty: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="shrink-0 rounded-md border p-2"
      style={{ borderColor: "rgba(200,162,75,0.35)", background: "var(--paper)" }}
    >
      <div className="mb-1 flex items-center gap-2">
        <NotebookPen className="h-3 w-3" style={{ color: "var(--brass, #c8a24b)" }} />
        <span
          className="text-[12px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}
        >
          Scratchpad
        </span>
        <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
          The model's rolling memory — survives when older chat gets trimmed.
        </span>
        <div className="ml-auto flex items-center gap-1">
          {dirty && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-foreground/5 disabled:opacity-50"
              style={{ borderColor: "var(--brass, #c8a24b)", color: "var(--ink)" }}
            >
              {saving ? "Saving…" : "Save edits"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-5 w-5 place-items-center rounded hover:bg-foreground/5"
            style={{ color: "var(--ink-muted)" }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Empty. The assistant will write a running summary here after substantive research turns."
        rows={Math.min(10, Math.max(4, value.split("\n").length))}
        className="w-full resize-y rounded border bg-transparent px-2 py-1.5 text-[12px] leading-relaxed outline-none"
        style={{ borderColor: "var(--rule-card)", color: "var(--ink)", fontFamily: "var(--font-serif)" }}
      />
    </div>
  );
}
