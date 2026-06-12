import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from "react";
import { Bold, Italic, Heading2, Quote, List, Link as LinkIcon, Sparkles, Search, ScanText, History } from "lucide-react";

export type EditorCanvasHandle = {
  insertAtCursor: (md: string) => void;
  focus: () => void;
  getBody: () => string;
};

type Props = {
  initialTitle: string;
  initialBody: string;
  saveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: number | null;
  onChangeTitle: (t: string) => void;
  onChangeBody: (b: string) => void;
  onOpenResearch: () => void;
  onCiteCheck: () => void;
  onOpenVersions: () => void;
};

/**
 * Distraction-free contenteditable editor. Stores as markdown (rough — we
 * preserve plain text + line breaks + simple ATX headings/quotes/lists when
 * the user types them). Autosave happens upstream.
 */
export const EditorCanvas = forwardRef<EditorCanvasHandle, Props>(function EditorCanvas(
  { initialTitle, initialBody, saveState, lastSavedAt, onChangeTitle, onChangeBody, onOpenResearch, onCiteCheck, onOpenVersions },
  ref,
) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Seed initial body once
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
    onChangeBody(bodyRef.current.innerText);
  };

  const handleSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setShowToolbar(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setShowToolbar(false);
      return;
    }
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
    const text = sel?.toString() || url;
    wrapSelection(`[${text}](`, `${url})`);
  };

  const wordCount = (initialBody || "").trim().split(/\s+/).filter(Boolean).length;

  const saveLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "error" ? "Save failed — retrying" :
    lastSavedAt ? `Saved ${formatAgo(lastSavedAt)}` :
    "Draft";

  return (
    <div className="relative flex h-full min-h-0 flex-col" style={{ background: "var(--paper)" }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3" style={{ borderColor: "var(--rule-card)" }}>
        <input
          ref={titleRef}
          defaultValue={initialTitle}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Untitled draft"
          className="flex-1 bg-transparent text-xl tracking-tight outline-none placeholder:opacity-40"
          style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
        />
        <div className="hidden items-center gap-3 text-[10px] tracking-[0.2em] uppercase md:flex" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
          <span>{wordCount} words</span>
          <span className="opacity-50">·</span>
          <span className={saveState === "error" ? "text-destructive" : ""}>{saveLabel}</span>
        </div>
        <button
          type="button"
          onClick={onOpenResearch}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-px hover:shadow-sm"
          style={{ borderColor: "var(--brass, #c8a24b)", color: "var(--ink)", background: "color-mix(in oklab, var(--brass, #c8a24b) 10%, transparent)" }}
        >
          <Search className="h-3.5 w-3.5" />
          Open Research
        </button>
        <button
          type="button"
          onClick={onCiteCheck}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-px hover:shadow-sm"
          style={{ borderColor: "var(--rule-card)", color: "var(--ink)" }}
          title="Verify every USC/CFR citation in your draft"
        >
          <ScanText className="h-3.5 w-3.5" />
          Check citations
        </button>
        <button
          type="button"
          onClick={onOpenVersions}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-px hover:shadow-sm"
          style={{ borderColor: "var(--rule-card)", color: "var(--ink)" }}
          title="Earlier saved versions of this draft"
        >
          <History className="h-3.5 w-3.5" />
          Versions
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-y-auto">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          spellCheck
          className="mx-auto min-h-full max-w-2xl px-8 py-10 text-[16px] leading-[1.75] outline-none"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
          data-placeholder="Start typing, paste a brief, or hit Open Research to pull statutes in…"
        />
      </div>

      {/* Floating selection toolbar */}
      {showToolbar && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border px-1 py-1 shadow-lg"
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
          <TBtn onClick={() => prefixLines("> ")} title="Quote"><Quote className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={() => prefixLines("- ")} title="List"><List className="h-3.5 w-3.5" /></TBtn>
          <TBtn onClick={insertLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></TBtn>
          <div className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.2)" }} />
          <TBtn onClick={() => wrapSelection("==", "==")} title="Highlight"><span className="h-3.5 w-3.5 rounded-sm" style={{ background: "var(--ochre)" }} /></TBtn>
          <TBtn onClick={onOpenResearch} title="Ask AI to rewrite"><Sparkles className="h-3.5 w-3.5" style={{ color: "var(--brass, #c8a24b)" }} /></TBtn>
        </div>
      )}

      <style>{`[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);color:var(--ink-muted);opacity:.5;pointer-events:none;}`}</style>
    </div>
  );
});

function TBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/10"
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