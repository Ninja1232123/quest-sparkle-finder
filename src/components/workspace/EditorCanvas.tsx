import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from "react";
import { Bold, Italic, Heading2, Quote, List, Link as LinkIcon, Sparkles, Search, ScanText, History, ChevronDown, ChevronUp, Check, X } from "lucide-react";

export type EditorCanvasHandle = {
  insertAtCursor: (md: string) => void;
  focus: () => void;
  getBody: () => string;
};

export type PendingEdit = {
  id: string;
  kind: "insert" | "replace";
  anchor: string | null;
  markdown: string;
  why: string;
};

type Props = {
  initialTitle: string;
  initialBody: string;
  saveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: number | null;
  supportCount: number;
  questionCount: number;
  onChangeTitle: (t: string) => void;
  onChangeBody: (b: string) => void;
  onOpenResearch: () => void;
  onCiteCheck: () => void;
  onOpenVersions: () => void;
  pendingEdits?: PendingEdit[];
  onAcceptEdit?: (edit: PendingEdit) => void;
  onRevertEdit?: (id: string) => void;
  onEditPendingMarkdown?: (id: string, markdown: string) => void;
};

export const EditorCanvas = forwardRef<EditorCanvasHandle, Props>(function EditorCanvas(
  { initialTitle, initialBody, saveState, lastSavedAt, supportCount, questionCount,
    onChangeTitle, onChangeBody, onOpenResearch, onCiteCheck, onOpenVersions,
    pendingEdits, onAcceptEdit, onRevertEdit, onEditPendingMarkdown },
  ref,
) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [headerOpen, setHeaderOpen] = useState(false);
  const [court, setCourt] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [plaintiff, setPlaintiff] = useState("");
  const [defendant, setDefendant] = useState("");

  useEffect(() => {
    if (bodyRef.current && bodyRef.current.innerText !== initialBody) {
      bodyRef.current.innerText = initialBody;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    insertAtCursor: (md: string) => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        el.innerText = el.innerText + (el.innerText ? "\n\n" : "") + md;
      } else {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode((el.innerText ? "\n\n" : "") + md + "\n"));
        range.collapse(false);
      }
      onChangeBody(el.innerText);
    },
    focus: () => bodyRef.current?.focus(),
    getBody: () => bodyRef.current?.innerText ?? "",
  }));

  const handleInput = () => {
    if (!bodyRef.current) return;
    const text = bodyRef.current.innerText;
    onChangeBody(text);
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  };

  const handleSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setShowToolbar(false); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { setShowToolbar(false); return; }
    setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShowToolbar(true);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelect);
    return () => document.removeEventListener("selectionchange", handleSelect);
  }, [handleSelect]);

  const wrapSelection = (before: string, after = before) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !bodyRef.current) return;
    const text = sel.toString();
    if (!text) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(`${before}${text}${after}`));
    range.collapse(false);
    handleInput();
  };

  const prefixLines = (prefix: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !bodyRef.current) return;
    const text = sel.toString() || "";
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const result = (text || "Heading").split("\n").map((l) => `${prefix}${l}`).join("\n");
    range.insertNode(document.createTextNode(result));
    range.collapse(false);
    handleInput();
  };

  const insertLink = () => {
    const url = window.prompt("URL");
    if (!url) return;
    const sel = window.getSelection();
    const selectedText = sel?.toString();
    if (selectedText) { wrapSelection(`[${selectedText}](`, `${url})`); return; }
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const md = `[${url}](${url})`;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.insertNode(document.createTextNode(md));
      range.collapse(false);
    } else {
      el.innerText = el.innerText + md;
    }
    handleInput();
  };

  const [wordCount, setWordCount] = useState(() =>
    (initialBody || "").trim().split(/\s+/).filter(Boolean).length,
  );

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "error" ? "Save failed" :
    lastSavedAt ? `Saved ${formatAgo(lastSavedAt)}` : "Draft";

  // Progress — how "ready" this draft looks
  const hasAuthority = supportCount > 0;
  const hasNoOpenQ = questionCount === 0;
  const hasWords = wordCount >= 50;

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={{ background: "var(--paper)" }}>

      {/* Top toolbar */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-2"
        style={{ borderColor: "var(--rule-card)" }}
      >
        {/* Title */}
        <input
          ref={titleRef}
          defaultValue={initialTitle}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Untitled draft"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-tight outline-none placeholder:opacity-30"
          style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
        />

        {/* Save status */}
        <div
          className="hidden shrink-0 items-center gap-2 text-[12px] tracking-[0.18em] uppercase lg:flex"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}
        >
          <span>{wordCount} words</span>
          <span className="opacity-40">·</span>
          <span className={saveState === "error" ? "text-destructive" : ""}>{saveLabel}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ToolBtn onClick={onOpenResearch} accent title="Open Research">
            <Search className="h-3.5 w-3.5" /> Research
          </ToolBtn>
          <ToolBtn onClick={onCiteCheck} title="Check every USC/CFR citation">
            <ScanText className="h-3.5 w-3.5" /> Cite check
          </ToolBtn>
          <ToolBtn onClick={onOpenVersions} title="Earlier saved versions">
            <History className="h-3.5 w-3.5" /> Versions
          </ToolBtn>
        </div>
      </div>

      {/* Progress strip */}
      <div
        className="flex shrink-0 items-center gap-4 border-b px-5 py-1.5"
        style={{ borderColor: "var(--rule-card)", background: "color-mix(in oklab, var(--paper-tint) 60%, transparent)" }}
      >
        <Pip on={hasAuthority} label={hasAuthority ? `${supportCount} ${supportCount === 1 ? "authority" : "authorities"} pinned` : "No authorities yet"} />
        <Pip on={hasNoOpenQ && questionCount === 0 && hasWords} label={questionCount > 0 ? `${questionCount} unresolved ${questionCount === 1 ? "question" : "questions"}` : "No open questions"} warn={questionCount > 0} />
        <Pip on={hasWords} label={hasWords ? `${wordCount} words drafted` : "Start drafting"} />
        <button
          type="button"
          onClick={() => setHeaderOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] transition-colors hover:bg-foreground/6"
          style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}
        >
          {headerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {headerOpen ? "Hide header" : "Document header"}
        </button>
      </div>

      {/* Document header — court, parties, case info */}
      {headerOpen && (
        <div
          className="shrink-0 border-b px-8 py-5"
          style={{ borderColor: "var(--rule-card)", background: "color-mix(in oklab, var(--paper) 85%, var(--paper-tint))" }}
        >
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="text-[12px] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              Filing information
            </div>
            {/* Court + Case No. */}
            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <Field
                label="Court"
                value={court}
                onChange={setCourt}
                placeholder="e.g. U.S. District Court, N.D. California"
              />
              <Field
                label="Case No."
                value={caseNo}
                onChange={setCaseNo}
                placeholder="e.g. 3:24-cv-01234"
                compact
              />
            </div>
            {/* Parties */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <Field
                label="Plaintiff"
                value={plaintiff}
                onChange={setPlaintiff}
                placeholder="Your name"
              />
              <Field
                label="Defendant"
                value={defendant}
                onChange={setDefendant}
                placeholder="Opposing party"
              />
            </div>
            {/* Visual v. divider */}
            {(plaintiff || defendant) && (
              <div className="text-center text-[12px] font-semibold tracking-widest py-0.5" style={{ color: "var(--ink-muted)" }}>
                — v. —
              </div>
            )}
            <p className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              Header is for your reference — it doesn't affect the draft body. Use the Document Builder to generate a court-formatted PDF.
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="relative flex-1 overflow-y-auto">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          spellCheck
          className="mx-auto min-h-full max-w-2xl px-8 py-10 text-[16px] leading-[1.8] outline-none"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
          data-placeholder="Start here. State what happened, what law was broken, and what you want. One fact per sentence."
        />
      </div>

      {/* Floating selection toolbar */}
      {showToolbar && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border px-1.5 py-1 shadow-xl"
          style={{
            left: toolbarPos.x,
            top: toolbarPos.y - 8,
            background: "var(--ink)",
            borderColor: "var(--brass, #c8a24b)",
            color: "var(--paper-soft)",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <TBtn onClick={() => wrapSelection("**")} title="Bold"><Bold className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => wrapSelection("_")} title="Italic"><Italic className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => prefixLines("## ")} title="Heading"><Heading2 className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => prefixLines("> ")} title="Block quote"><Quote className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => prefixLines("- ")} title="List"><List className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={insertLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></TBtn>
          <div className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.18)" }} />
          <TBtn onClick={() => wrapSelection("==", "==")} title="Highlight">
            <span className="h-3.5 w-3.5 rounded-sm" style={{ background: "var(--ochre)" }} />
          </TBtn>
          <TBtn onClick={onOpenResearch} title="Ask AI about selection">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--brass, #c8a24b)" }} />
          </TBtn>
        </div>
      )}

      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--ink-muted);
          opacity: .45;
          pointer-events: none;
          font-style: italic;
        }
      `}</style>
    </div>
  );
});

// ── Sub-components ──────────────────────────────────────────────────────────

function ToolBtn({ children, onClick, title, accent }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-all hover:-translate-y-px hover:shadow-sm"
      style={{
        borderColor: accent ? "var(--brass, #c8a24b)" : "var(--rule-card)",
        color: "var(--ink)",
        background: accent ? "color-mix(in oklab, var(--brass, #c8a24b) 10%, transparent)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function Pip({ on, label, warn }: { on: boolean; label: string; warn?: boolean }) {
  const color = warn ? "#a8413a" : on ? "#3f7d4e" : "var(--ink-muted)";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full transition-colors"
        style={{ background: on && !warn ? "#3f7d4e" : warn ? "#a8413a" : "var(--rule-card)" }}
      />
      <span className="text-[12px] tracking-[0.12em]" style={{ color, fontFamily: "var(--font-mono)" }}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, compact }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "w-44" : ""}>
      <div className="mb-1 text-[12px] font-medium tracking-[0.25em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border bg-transparent px-2 py-1.5 text-[12px] outline-none transition-colors focus:border-foreground/30"
        style={{ borderColor: "var(--rule-card)", fontFamily: "var(--font-serif)", color: "var(--ink)" }}
      />
    </div>
  );
}

function TBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/12"
    >
      {children}
    </button>
  );
}

function formatAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(ts).toLocaleTimeString();
}
