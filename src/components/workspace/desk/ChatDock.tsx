import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import type { DefaultChatTransport, UIMessage } from "ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Square } from "lucide-react";

type Props = {
  threadId: string;
  transport: DefaultChatTransport<UIMessage>;
  initialMessages: UIMessage[];
  /** When the model proposes a search, the desk can route it into a container. */
  onProposeSearch?: (query: string, source?: string) => void;
};

const INTRO_PROMPTS = [
  "Help me find every authority for and against my position — go down the list, federal and state.",
  "What's the strongest thing the other side will cite, and what answers it?",
  "Read what I pulled into Supportive and tell me what's still missing.",
];

// Tool calls whose output is a list of corpus/case hits — rendered as a visible
// clickable results list (the "shitload of results, pushed to the browser")
// instead of a collapsed JSON blob, so the user sees the whole field the model
// pulled, not just the model's eventual reply.
const SEARCH_TOOLS = new Set(["scan_corpus", "search_corpus", "search_boolean", "search_cases"]);

type HitRow = {
  id?: string; identifier?: string; cite?: string; citation?: string;
  title?: string; heading?: string | null; source?: string; court?: string;
  year?: number | null; url?: string;
};

function SearchResults({ toolName, input, output }: { toolName: string; input?: unknown; output?: unknown }) {
  const out = output as { count?: number; results?: HitRow[]; error?: string } | undefined;
  const rows = out?.results ?? [];
  const isCase = toolName === "search_cases";
  const inp = input as { q?: string; all?: string[]; any?: string[]; phrase?: string } | undefined;
  const query = inp?.q ?? inp?.phrase ?? [...(inp?.all ?? []), ...(inp?.any ?? [])].join(" ") ?? "";

  if (out?.error) {
    return <div className="mx-1 my-1 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">search error: {out.error}</div>;
  }
  if (rows.length === 0) return null;

  return (
    <div className="my-1 overflow-hidden rounded-lg border" style={{ borderColor: "var(--rule-card)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5" style={{ borderColor: "var(--rule-card)", background: "var(--paper-soft)" }}>
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
          {out?.count ?? rows.length} results{query ? ` · ${query}` : ""}
        </span>
      </div>
      <ul className="max-h-72 divide-y overflow-y-auto" style={{ borderColor: "var(--rule-card)" }}>
        {rows.map((r, i) => {
          const id = r.id ?? r.identifier ?? "";
          const label = r.cite ?? r.citation ?? r.title ?? id;
          const sub = isCase ? [r.court, r.year].filter(Boolean).join(" · ") : (r.heading || null);
          const splat = id.replace(/^\//, "");
          const inner = (
            <>
              <span className="block truncate text-[12px] font-medium" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>{label}</span>
              {sub && <span className="block truncate text-[10px]" style={{ color: "var(--ink-muted)" }}>{sub}</span>}
            </>
          );
          return (
            <li key={id || i} className="px-2.5 py-1.5 transition-colors hover:bg-foreground/[0.03]">
              {!isCase && splat ? (
                <Link to="/code/$" params={{ _splat: splat }} className="block">{inner}</Link>
              ) : r.url ? (
                <a href={r.url} className="block">{inner}</a>
              ) : (
                <div className="block">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatDock({ threadId, transport, initialMessages, onProposeSearch }: Props) {
  const chat = useChat({ id: threadId, messages: initialMessages, transport });
  const { messages, sendMessage, status, error, stop } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const proposed = useRef<Set<string>>(new Set());

  // Surface model-proposed searches to the desk so they can fill a container.
  useEffect(() => {
    if (!onProposeSearch) return;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        const p = part as { type?: string; toolCallId?: string; output?: { proposal?: string; query?: string; source?: string } };
        if (p.type === "tool-propose_search" && p.output?.proposal === "search" && p.toolCallId && !proposed.current.has(p.toolCallId)) {
          proposed.current.add(p.toolCallId);
          onProposeSearch(p.output.query ?? "", p.output.source);
        }
      }
    }
  }, [messages, onProposeSearch]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l bg-paper-tint" style={{ borderColor: "var(--rule-card)" }}>
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--rule-card)" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--brass)" }} />
        <span className="text-[10px] uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
          Research partner
        </span>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="px-4 py-6">
              <p className="text-[14px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                You drive. I dig.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                I read the corpus before I speak, and I&apos;m as uncertain of the law as you are — so we check it together. Tell me the matter and I&apos;ll go down the list, container by container, for what cuts your way and what cuts against.
              </p>
              <div className="mt-4 space-y-2">
                {INTRO_PROMPTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void sendMessage({ text: t })}
                    className="w-full rounded-lg border bg-paper-soft px-3 py-2 text-left text-[12px] leading-snug transition-all hover:-translate-y-px hover:shadow-sm disabled:opacity-50"
                    style={{ borderColor: "var(--rule-card)", color: "var(--ink)", fontFamily: "var(--font-serif)" }}
                  >
                    {t}
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
                    // Search hits render as a visible, clickable results list.
                    if (SEARCH_TOOLS.has(toolName)) {
                      if (tp.output != null) return <SearchResults key={tp.toolCallId ?? i} toolName={toolName} input={tp.input} output={tp.output} />;
                      return <div key={tp.toolCallId ?? i} className="px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>scanning the corpus…</div>;
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

          {status === "submitted" && <div className="px-4 py-2"><Shimmer>Reading the corpus…</Shimmer></div>}
          {error && <div className="mx-3 my-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error.message}</div>}
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
          <PromptInputTextarea placeholder="Ask, discuss, or describe the matter…" />
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
    </aside>
  );
}
