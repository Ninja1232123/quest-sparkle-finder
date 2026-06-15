import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSessionDraft, upsertSessionDraft } from "@/lib/workspace.functions";
import { PenLine, Check, Loader2, AlertCircle } from "lucide-react";

export type NotepadHandle = {
  insertAtCursor: (text: string) => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  threadId: string;
  registerHandle: (h: NotepadHandle) => void;
};

export function MarginNotepad({ threadId, registerHandle }: Props) {
  const loadDraft = useServerFn(getSessionDraft);
  const saveDraft = useServerFn(upsertSessionDraft);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState("Pleading draft");
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const dirtyRef = useRef(false);
  const latest = useRef({ title, body });
  latest.current = { title, body };

  // Load existing draft (graceful when the local DB is unreachable).
  useEffect(() => {
    let alive = true;
    loadDraft({ data: { threadId } })
      .then((r) => {
        if (!alive) return;
        const row = r as { title?: string; body_md?: string } | null;
        if (row) {
          setTitle(row.title ?? "Pleading draft");
          setBody(row.body_md ?? "");
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [threadId, loadDraft]);

  // Expose an imperative insert handle to the desk.
  useEffect(() => {
    registerHandle({
      insertAtCursor: (text: string) => {
        const ta = taRef.current;
        if (!ta) { setBody((b) => (b ? `${b}\n\n${text}` : text)); return; }
        const start = ta.selectionStart ?? body.length;
        const end = ta.selectionEnd ?? body.length;
        const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
        setBody(next);
        dirtyRef.current = true;
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + text.length;
          ta.setSelectionRange(pos, pos);
        });
      },
    });
  }, [body, registerHandle]);

  // Debounced autosave.
  useEffect(() => {
    if (!ready) return;
    dirtyRef.current = true;
    const t = setTimeout(async () => {
      if (!dirtyRef.current) return;
      setSave("saving");
      try {
        await saveDraft({ data: { threadId, title: latest.current.title || "Pleading draft", bodyMd: latest.current.body } });
        dirtyRef.current = false;
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [title, body, ready, saveDraft, threadId]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-paper-tint" style={{ borderColor: "var(--rule-card)" }}>
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--rule-card)" }}>
        <PenLine className="h-3.5 w-3.5" style={{ color: "var(--ink-muted)" }} />
        <span className="text-[12px] uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
          In the margins
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
          {save === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving</>}
          {save === "saved" && <><Check className="h-3 w-3" /> Saved</>}
          {save === "error" && <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> Local only</span>}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="shrink-0 border-b bg-transparent px-3 py-2 text-[14px] font-semibold outline-none"
        style={{ borderColor: "var(--rule-card)", color: "var(--ink)", fontFamily: "var(--font-serif)" }}
        placeholder="Draft title"
      />

      <textarea
        ref={taRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write the pleading here. Pull authority from the buckets and weave it in — the exact language sits right beside you."
        className="min-h-0 flex-1 resize-none bg-transparent px-3 py-3 text-[13px] leading-relaxed outline-none"
        style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}
        spellCheck
      />
    </div>
  );
}
