/**
 * Juri — the talking eagle.
 *
 * Bottom-left corner widget: a gold eagle icon that opens a grounded AI
 * chat panel. Every response is retrieved from the corpus and cited by
 * section identifier. Credit-gated — the badge shows remaining credits.
 *
 * Mounted once in __root.tsx, visible on every page. Reads the current
 * route to know which section the user is viewing (passes context_identifier
 * to the server function so Juri reads the page they're on).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { askJuri, getJuriCredits } from "@/lib/juri.functions";
import { seedThreadFromHandoff } from "@/lib/workspace.functions";
import { CREDIT_PACKS, centsPerCredit, PRO_MONTHLY_CREDITS, JURI_MODES, type CreditPack, type JuriMode } from "@/lib/juri-credits";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { X, Send, Coins, ArrowUpRight, Loader2, ArrowLeft, Sparkles, Check, Search, ExternalLink, Trash2, ArrowUpRightSquare } from "lucide-react";
import type { ClCaseResult } from "@/lib/court-cases";

// ── Eagle SVG (profile silhouette — reads at 40px) ──────────────────────
function EagleSvg({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="currentColor"
    >
      {/* Stylized bald eagle head profile — right-facing, bold strokes */}
      <path d="M72 18c-8-6-18-4-24 2-4 4-6 10-5 16l-2 1c-3 1-6 4-7 7-2 5 0 10 3 13l4 3c-1 3 0 6 2 8l6 4-1 3c-1 4 1 8 4 10l8 4c3 2 7 1 9-1l3-4 4-1c5-2 8-7 8-12v-6l2-3c3-5 3-11 0-16-2-4-5-7-8-9l-3-8c-1-4-3-7-6-9l2-2zM58 32c1-4 4-7 8-8 3-1 6 0 8 2l2 5c-3-1-6-1-9 1-3 1-5 4-6 7l-3-2v-5zm14 8c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4zm-8 22l6-2c2 0 3 1 3 3l-2 4-6 2c-2 0-3-1-3-3l2-4z" />
      {/* Beak accent */}
      <path
        d="M76 48l8-2c3-1 5 0 6 2l-3 5-8 3c-3 1-5-1-5-3l2-5z"
        fill="var(--m-gold, #c8a24b)"
        opacity="0.9"
      />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────

type JuriCitation = {
  identifier: string;
  section_label: string | null;
  heading: string | null;
  source_code: string;
};

type Message = {
  role: "user" | "juri";
  text: string;
  citations?: JuriCitation[];
  error?: boolean;
  /** A call-to-action to render under an error: upsell Pro, or buy credits. */
  cta?: "pro" | "buy";
  /** Metering receipt shown under an answer. */
  creditsCharged?: number;
  sectionsRead?: number;
  connectionsRead?: number;
  searches?: string[];
  /** How many plain-English readings were saved as labeled AI interpretations. */
  interpretationsRecorded?: number;
  /** Cases Juri found via search_cases — rendered as clickable CourtListener chips. */
  casesFound?: ClCaseResult[];
  /** Queries Juri ran against CourtListener — link to CL search, not corpus search. */
  caseSearches?: string[];
};

const SOURCE_SHORT: Record<string, string> = {
  const: "Const.", usc: "U.S.C.", cfr: "C.F.R.", ucc: "U.C.C.",
  tfm: "TFM", irm: "IRM", register: "Fed. Reg.", bill: "Bill",
};

// ── Session persistence ──────────────────────────────────────────────────────

const SESSION_KEY = "juri_messages_v1";
const SESSION_MAX = 40; // keep last N messages so storage stays small

function loadSessionMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionMessages(msgs: Message[]) {
  try {
    const trimmed = msgs.slice(-SESSION_MAX);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(trimmed));
  } catch {
    // sessionStorage quota exceeded — skip silently
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function Juri() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "buy">("chat");
  const [mode, setMode] = useState<JuriMode>("quick");
  const [caseText, setCaseText] = useState("");
  const [keywords, setKeywords] = useState("");
  const [checkoutPack, setCheckoutPack] = useState<CreditPack | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => loadSessionMessages());
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, session } = useAuth();
  const { isPro } = useSubscription();
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const seedHandoff = useServerFn(seedThreadFromHandoff);
  const [handoffLoading, setHandoffLoading] = useState(false);

  const continueInWorkspace = useCallback(async () => {
    if (!user || messages.length === 0 || handoffLoading) return;
    const ok = window.confirm(
      "Continue this chat in the AI Workspace?\n\n" +
      "Reminder: the Workspace is an AI research and drafting tool. It is NOT legal advice, " +
      "AI can be wrong, and you are responsible for verifying every citation and consulting a " +
      "licensed attorney before relying on anything it produces. Use at your own risk.",
    );
    if (!ok) return;
    setHandoffLoading(true);
    try {
      const uiMessages = messages.map((m) => ({
        role: m.role === "juri" ? "assistant" : "user",
        parts: [{ type: "text", text: m.text }],
      }));
      const firstUser = messages.find((m) => m.role === "user")?.text ?? "Continued from Juri";
      const title = firstUser.slice(0, 80);
      const res = await seedHandoff({ data: { title, messages: uiMessages } });
      setOpen(false);
      router.navigate({ to: "/workspace/$threadId", params: { threadId: res.threadId } });
    } catch (e) {
      console.error("Workspace handoff failed", e);
    } finally {
      setHandoffLoading(false);
    }
  }, [user, messages, handoffLoading, seedHandoff, router]);

  // Current section or case identifier from the URL — passed to askJuri so
  // Juri knows what the user is reading. /case/{id} triggers the read_case
  // auto-hint; /code/... identifies the statute.
  const contextId = (() => {
    const path = router.state.location.pathname;
    const m = path.match(/^\/code\/(.+)/);
    if (m && !m[1].startsWith("source/")) return "/" + m[1];
    const cm = path.match(/^\/case\/(\d+)/);
    if (cm) return `/case/${cm[1]}`;
    return undefined;
  })();

  // Fetch credits on mount and when auth changes
  useEffect(() => {
    if (!user) { setCredits(null); return; }
    getJuriCredits().then((r) => setCredits(r.credits)).catch(() => setCredits(0));
  }, [user?.id]);

  // Persist messages to sessionStorage so a refresh restores the conversation.
  useEffect(() => {
    saveSessionMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Dock the panel beneath the sticky site header so it never covers the nav.
  // Measured live (the header height changes with the dev banner / breakpoints).
  useEffect(() => {
    if (!open) return;
    const header = document.querySelector(".am-header");
    const measure = () => {
      const b = header?.getBoundingClientRect().bottom ?? 0;
      setHeaderOffset(Math.max(0, Math.round(b)));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" && header ? new ResizeObserver(measure) : null;
    if (ro && header) ro.observe(header);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [open]);

  // Tell the layout when the drawer is open so it can push content right
  // (see `html.juri-open #main` in styles.css). Cleared on unmount.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("juri-open", open);
    return () => root.classList.remove("juri-open");
  }, [open]);

  const submit = useCallback(async (textOverride?: string) => {
    const q = (typeof textOverride === "string" ? textOverride : draft).trim();
    if (!q || loading) return;

    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      // Thread so far (excludes the question we're about to send) → lets Juri
      // handle follow-ups and the clarify → refine → search flow.
      const history = messages
        .filter((m) => !m.error && m.text.trim())
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await askJuri({
        data: {
          query: q,
          context_identifier: contextId,
          auth_token: session?.access_token,
          mode,
          history,
        },
      });

      if (res.error) {
        const cta = res.pro_required ? "pro" : res.out_of_credits ? "buy" : undefined;
        setMessages((prev) => [...prev, { role: "juri", text: res.error!, error: true, cta }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "juri",
          text: res.answer,
          citations: res.citations,
          creditsCharged: res.credits_charged,
          sectionsRead: res.sections_read,
          connectionsRead: res.connections_read,
          searches: res.searches,
          caseSearches: res.case_searches,
          casesFound: res.cases_found,
          interpretationsRecorded: res.interpretations_recorded,
        }]);
        setCredits(res.credits_remaining);
      }
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: "juri",
        text: "Something went wrong. Try again.",
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [draft, loading, contextId, session?.access_token, mode, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // First-prompt template → compose the user's situation + seed keywords into
  // the opening message so Juri starts with real intent and search terms.
  const startFromTemplate = useCallback(() => {
    const c = caseText.trim();
    const k = keywords.trim();
    if (!c && !k) return;
    const composed = [
      c && `Here's my situation, in one sentence: ${c}`,
      k && `Keywords I think might be relevant: ${k}`,
      "Let's take a look at what comes up.",
    ].filter(Boolean).join("\n");
    setCaseText("");
    setKeywords("");
    submit(composed);
  }, [caseText, keywords, submit]);

  // ── Render ──

  return (
    <>
      {/* Eagle launcher — bottom-left. Closed only; the close control lives
          in the drawer header so it never overlaps the input. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="juri-btn"
          aria-label="Ask Juri"
          title="Ask Juri"
        >
          <EagleSvg size={32} />
          {user && credits !== null && credits < 9999 && (
            <span className="juri-badge">{credits}</span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="juri-panel" role="dialog" aria-label="Juri — AI assistant" style={{ top: headerOffset }}>
          {/* Header */}
          <div className="juri-header">
            <div className="juri-header-left">
              {view === "buy" ? (
                <button
                  type="button"
                  onClick={() => { setView("chat"); setCheckoutPack(null); }}
                  className="juri-close-btn"
                  aria-label="Back to chat"
                  title="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <EagleSvg size={28} className="juri-header-eagle" />
              )}
              <div>
                <div className="juri-wordmark">{view === "buy" ? "GET CREDITS" : "JURI"}</div>
                <div className="juri-subtitle">
                  {view === "buy" ? "credits never expire · spent by an answer's depth" : "reads the statute · cites the source"}
                </div>
              </div>
            </div>
            <div className="juri-header-right">
              {user && credits !== null && view === "chat" && (
                <button
                  type="button"
                  onClick={() => setView("buy")}
                  className="juri-credit-pill"
                  title="Credits remaining — tap to get more"
                  style={{ cursor: "pointer" }}
                >
                  <Coins className="h-3 w-3" />
                  <span>{credits >= 9999 ? "∞" : credits}</span>
                </button>
              )}
              {messages.length > 0 && view === "chat" && (
                <>
                  {user && (
                    <button
                      type="button"
                      onClick={continueInWorkspace}
                      disabled={handoffLoading}
                      className="juri-close-btn"
                      aria-label="Continue in workspace"
                      title="Continue in workspace"
                    >
                      {handoffLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUpRightSquare className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => { setMessages([]); sessionStorage.removeItem(SESSION_KEY); }}
                  className="juri-close-btn"
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setOpen(false); setView("chat"); setCheckoutPack(null); }}
                className="juri-close-btn"
                aria-label="Close Juri"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Buy-credits view — replaces the chat body */}
          {view === "buy" ? (
            <div className="juri-messages">
              {checkoutPack ? (
                <div>
                  <div className="mb-3 text-center font-display text-sm font-semibold text-foreground/80">
                    {checkoutPack.credits} credits · ${(checkoutPack.priceCents / 100).toFixed(0)}
                  </div>
                  <StripeEmbeddedCheckout creditPackId={checkoutPack.lookupKey} returnPath={currentPath} />
                </div>
              ) : !isPro ? (
                <div className="juri-empty">
                  <Sparkles className="h-10 w-10 text-ochre" />
                  <div className="juri-empty-title">Juri is a Pro tool</div>
                  <div className="juri-empty-hint">
                    Pro is $5/mo and includes {PRO_MONTHLY_CREDITS} Juri credits every month — most
                    answers run a credit or two, deeper research more. Unlock Juri and the rest of the research desk.
                  </div>
                  <Link
                    to="/subscribe"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground shadow-[var(--shadow-warm)] hover:-translate-y-0.5 transition-transform"
                    onClick={() => setOpen(false)}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Go Pro — $5/mo →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 px-1 py-1">
                  <p className="text-center text-xs leading-relaxed text-foreground/60">
                    You get {PRO_MONTHLY_CREDITS} Juri credits a month with Pro. Running low?
                    Top up here — <span className="font-semibold">credits never expire, and they stretch further here.</span>
                  </p>
                  {CREDIT_PACKS.map((pack) => (
                    <button
                      key={pack.lookupKey}
                      type="button"
                      onClick={() => setCheckoutPack(pack)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow-warm)]"
                    >
                      <Coins className="h-5 w-5 shrink-0 text-ochre" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-semibold">{pack.label}</span>
                          {pack.badge && (
                            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                              {pack.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-foreground/55">
                          {pack.credits.toLocaleString()} credits · {centsPerCredit(pack).toFixed(1)}¢ each
                        </div>
                      </div>
                      <div className="font-display text-base font-bold">
                        ${(pack.priceCents / 100).toFixed(0)}
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-foreground/45">
                    <Check className="h-3 w-3" /> Secure checkout by Stripe
                  </div>
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Messages */}
          <div className="juri-messages" ref={scrollRef}>
            {messages.length === 0 && !loading && (
              <div className="juri-empty">
                <EagleSvg size={44} className="juri-empty-eagle" />
                <div className="juri-empty-title">Let's figure out what's written.</div>
                <div className="juri-empty-hint">
                  I'm not a search box — we work this together. Tell me the gist and a few
                  terms you'd start with, and I'll go pull threads and see what comes up.
                </div>
                <div className="juri-template">
                  <label className="juri-tmpl-label">Your situation, in one sentence</label>
                  <textarea
                    value={caseText}
                    onChange={(e) => setCaseText(e.target.value)}
                    placeholder={contextId ? "e.g. I'm trying to understand how this section applies to a dispute over…" : "e.g. A collector is calling about a debt I don't think is mine."}
                    rows={2}
                    className="juri-tmpl-input"
                  />
                  <label className="juri-tmpl-label">Keywords you think are relevant</label>
                  <input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startFromTemplate(); } }}
                    placeholder="e.g. debt validation, dispute, 30 days"
                    className="juri-tmpl-input"
                  />
                  <button
                    type="button"
                    onClick={startFromTemplate}
                    disabled={!caseText.trim() && !keywords.trim()}
                    className="juri-tmpl-go"
                  >
                    Let's take a look →
                  </button>
                  <div className="juri-tmpl-or">…or just ask me anything below.</div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`juri-msg ${msg.role === "user" ? "juri-msg-user" : "juri-msg-eagle"} ${msg.error ? "juri-msg-error" : ""}`}>
                {msg.role === "juri" && (
                  <div className="juri-msg-avatar">★</div>
                )}
                <div className="juri-msg-body">
                  <div className="juri-msg-text">{msg.text}</div>
                  {msg.cta === "pro" && (
                    <Link
                      to="/subscribe"
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground hover:-translate-y-0.5 transition-transform"
                    >
                      <Sparkles className="h-3 w-3" /> Unlock Juri — Go Pro $5/mo →
                    </Link>
                  )}
                  {msg.cta === "buy" && (
                    <button
                      type="button"
                      onClick={() => setView("buy")}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground hover:-translate-y-0.5 transition-transform"
                    >
                      <Coins className="h-3 w-3" /> Get more credits →
                    </button>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="juri-sources">
                      <div className="juri-sources-label">What we pulled up — open any of these</div>
                      {msg.citations.map((c) => (
                        <Link
                          key={c.identifier}
                          to="/code/$"
                          params={{ _splat: c.identifier.replace(/^\//, "") }}
                          className="juri-source-chip"
                          /* Stay open: opening a section keeps Juri docked
                             beside it so we're looking at the same thing and
                             the conversation can continue. */
                        >
                          <span className="juri-source-code">
                            {SOURCE_SHORT[c.source_code] ?? c.source_code.toUpperCase()}
                          </span>
                          <span className="juri-source-label">
                            {c.section_label ?? c.heading ?? c.identifier}
                          </span>
                          <ArrowUpRight className="h-2.5 w-2.5 shrink-0 opacity-50" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.casesFound && msg.casesFound.length > 0 && (
                    <div className="juri-sources">
                      <div className="juri-sources-label">Cases found — read on Self-Law</div>
                      {msg.casesFound.map((c, i) =>
                        c.cl_cluster_id ? (
                          <Link
                            key={i}
                            to="/case/$clusterId"
                            params={{ clusterId: String(c.cl_cluster_id) }}
                            className="juri-source-chip"
                            title={c.name}
                          >
                            {c.court && <span className="juri-source-code">{c.court}</span>}
                            <span className="juri-source-label">{c.name}</span>
                            {c.year && <span className="juri-source-code opacity-60">{c.year}</span>}
                            <ArrowUpRight className="h-2.5 w-2.5 shrink-0 opacity-50" />
                          </Link>
                        ) : (
                          <a
                            key={i}
                            href={c.url ?? `https://www.courtlistener.com/?q=${encodeURIComponent(c.name)}&type=o`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="juri-source-chip"
                          >
                            {c.court && <span className="juri-source-code">{c.court}</span>}
                            <span className="juri-source-label">{c.name}</span>
                            {c.year && <span className="juri-source-code opacity-60">{c.year}</span>}
                            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                          </a>
                        )
                      )}
                    </div>
                  )}
                  {msg.role === "juri" && !msg.error && msg.creditsCharged != null && (
                    <div className="juri-receipt">
                      {msg.creditsCharged} credit{msg.creditsCharged === 1 ? "" : "s"}
                      {msg.sectionsRead ? ` · read ${msg.sectionsRead} section${msg.sectionsRead === 1 ? "" : "s"}` : ""}
                      {msg.connectionsRead ? ` · ${msg.connectionsRead} via citations` : ""}
                      {msg.interpretationsRecorded ? ` · noted ${msg.interpretationsRecorded} AI interpretation${msg.interpretationsRecorded === 1 ? "" : "s"}` : ""}
                      {msg.searches && msg.searches.length > 0 && (
                        <div className="juri-receipt-searches">
                          <span className="juri-receipt-searches-lead">
                            statute searches — open full results:
                          </span>
                          <div className="juri-search-links">
                            {Array.from(new Set(msg.searches)).slice(0, 6).map((s, j) => (
                              <Link
                                key={j}
                                to="/search"
                                search={{ q: s }}
                                className="juri-search-link"
                                title={`Open results for "${s}" on the page — yours to filter and drive`}
                              >
                                <Search className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                <span className="juri-search-link-text">{s}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.caseSearches && msg.caseSearches.length > 0 && (
                        <div className="juri-receipt-searches">
                          <span className="juri-receipt-searches-lead">
                            case searches — open on CourtListener:
                          </span>
                          <div className="juri-search-links">
                            {msg.caseSearches.slice(0, 4).map((s, j) => (
                              <a
                                key={j}
                                href={`https://www.courtlistener.com/?q=${encodeURIComponent(s)}&type=o&order_by=score+desc`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="juri-search-link"
                                title={`Search CourtListener for "${s}"`}
                              >
                                <Search className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                <span className="juri-search-link-text">{s}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="juri-msg juri-msg-eagle">
                <div className="juri-msg-avatar juri-msg-avatar-loading">★</div>
                <div className="juri-msg-body">
                  <div className="juri-loading-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="juri-input-wrap">
            {!user ? (
              <Link
                to="/auth"
                search={{ mode: "signup", redirect: undefined }}
                className="juri-signin-prompt"
                onClick={() => setOpen(false)}
              >
                Sign in to talk to Juri →
              </Link>
            ) : (
              <>
                <div className="juri-mode-row" role="radiogroup" aria-label="Search depth">
                  {(Object.keys(JURI_MODES) as JuriMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`juri-mode-btn ${mode === m ? "active" : ""}`}
                      title={JURI_MODES[m].blurb}
                    >
                      {m === "deep" && <Sparkles className="h-3 w-3" />}
                      {JURI_MODES[m].label}
                    </button>
                  ))}
                  <span className="juri-mode-hint">
                    {mode === "deep" ? "follows the full chain · billed by depth" : "focused · billed by what it reads"}
                  </span>
                </div>
                <div className="juri-input-row">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      contextId?.startsWith("/case/")
                        ? "Ask about this case — holding, facts, how it applies…"
                        : contextId
                        ? "Ask about this section…"
                        : "Ask about any statute…"
                    }
                    rows={1}
                    className="juri-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={loading || !draft.trim()}
                    className="juri-send"
                    aria-label="Send"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
            <div className="juri-disclaimer">
              <strong>Not legal advice.</strong> AI can be wrong — verify every citation, read the
              source yourself, and consult a licensed attorney. Use at your own risk.
            </div>
          </div>
          </>
          )}
        </div>
      )}
    </>
  );
}
