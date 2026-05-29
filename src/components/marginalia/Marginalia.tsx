// ============================================================
// Marginalia.tsx — hand-placed handwritten margin notes
//
// Replaces the fixed-`top`-guess workflow. Notes carry their own
// content + position + style, render as real text (SSR-friendly,
// crawlable), and in DEV you get a drag-to-place editor that writes
// the JSX back out for you to paste here.
//
// USAGE (production):
//   import { Marginalia } from "@/components/marginalia/Marginalia";
//   import { HOME_NOTES } from "@/components/marginalia/marginalia-home-notes";
//   ...
//   <main className="relative">
//     <Marginalia notes={HOME_NOTES} />
//     ...page...
//   </main>
//
// In dev (import.meta.env.DEV), an "✎ Margins" button appears
// bottom-left. Click it → notes become draggable, a style panel
// opens, and "Copy JSX" puts the updated array on your clipboard.
// Paste it into marginalia-home-notes.ts and commit. The editor
// never ships to production.
//
// Positioning model: each note is absolute inside the nearest
// positioned ancestor (your <main className="relative">). `top` is
// px from the top; `x` is px offset from the horizontal CENTER of
// the page (negative = left of center, positive = right). Anchoring
// to center keeps notes in the gutters as the viewport resizes.
// Notes auto-hide below `hideBelow` px (default 1180) — no gutter.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MarginNote = {
  id: string;
  /** Small label line (e.g. "Amend. IX"). Optional. */
  cite?: string;
  /** Main handwritten text. */
  body: string;
  /** Fainter follow-up line. Optional. */
  aside?: string;
  /** px from top of the positioned ancestor. */
  top: number;
  /** px offset from horizontal page center. Negative = left. */
  x: number;
  /** Note box width in px. Default 210. */
  width?: number;
  /** Rotation in degrees. Default a small deterministic tilt. */
  rotation?: number;
  /** Ink color token. Default "ink". */
  color?: InkId;
  /** Body font size in px. Default 17. */
  size?: number;
};

export type InkId = "ink" | "terracotta" | "sage" | "ochre" | "pencil";

// Inks drawn from the site palette (src/styles.css). Kept as literal
// values so they read consistently in light & dark without extra wiring.
export const MARGIN_INKS: { id: InkId; label: string; light: string; dark: string }[] = [
  { id: "ink",        label: "Ink",        light: "oklch(0.30 0.012 70)", dark: "oklch(0.86 0.014 80)" },
  { id: "terracotta", label: "Terracotta", light: "oklch(0.42 0.13 30)",  dark: "oklch(0.62 0.10 40)" },
  { id: "sage",       label: "Sage",       light: "oklch(0.42 0.08 165)", dark: "oklch(0.62 0.08 165)" },
  { id: "ochre",      label: "Ochre",      light: "oklch(0.58 0.13 72)",  dark: "oklch(0.74 0.12 80)" },
  { id: "pencil",     label: "Pencil",     light: "oklch(0.50 0.010 75)", dark: "oklch(0.70 0.012 78)" },
];

function inkVar(id: InkId = "ink"): string {
  // Uses CSS custom props defined once by <MarginaliaStyle/> so dark mode
  // flips automatically.
  return `var(--mn-ink-${id})`;
}

function defaultTilt(id: string): number {
  // Deterministic -2.5..+2.5 from the id so unset rotations look organic.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 11) - 5) / 2;
}

// ---- One-time style block (fonts, ink vars, base classes) ----
function MarginaliaStyle() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@import url("https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap");
:root {
  --mn-ink-ink: oklch(0.30 0.012 70);
  --mn-ink-terracotta: oklch(0.42 0.13 30);
  --mn-ink-sage: oklch(0.42 0.08 165);
  --mn-ink-ochre: oklch(0.58 0.13 72);
  --mn-ink-pencil: oklch(0.50 0.010 75);
}
.dark {
  --mn-ink-ink: oklch(0.86 0.014 80);
  --mn-ink-terracotta: oklch(0.62 0.10 40);
  --mn-ink-sage: oklch(0.62 0.08 165);
  --mn-ink-ochre: oklch(0.74 0.12 80);
  --mn-ink-pencil: oklch(0.70 0.012 78);
}
.mn {
  position: absolute;
  font-family: "Architects Daughter", "Comic Sans MS", cursive;
  z-index: 2;
  opacity: 0.9;
  transition: opacity 200ms ease-out;
}
.mn-cite {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 3px;
  opacity: 0.85;
}
.mn-body { margin: 0; line-height: 1.42; }
.mn-aside { margin: 5px 0 0; font-size: 0.82em; opacity: 0.72; }
@media (hover: hover) {
  .mn:hover { opacity: 1; }
}
`,
      }}
    />
  );
}

// ---- A single rendered note (production-safe, no interactivity) ----
function NoteView({
  note,
  centerOffset,
  selected,
  editing,
  onPointerDown,
}: {
  note: MarginNote;
  centerOffset: number; // px = containerWidth/2
  selected?: boolean;
  editing?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const rot = note.rotation ?? defaultTilt(note.id);
  const color = inkVar(note.color);
  return (
    <aside
      className="mn"
      data-mn-id={note.id}
      aria-hidden={!editing}
      onPointerDown={onPointerDown}
      style={{
        top: note.top,
        left: centerOffset + note.x,
        width: note.width ?? 210,
        transform: `rotate(${rot}deg)`,
        color,
        cursor: editing ? "grab" : undefined,
        outline: selected ? "1.5px solid var(--mn-ink-terracotta)" : undefined,
        outlineOffset: 4,
        borderRadius: 4,
        userSelect: editing ? "none" : undefined,
      }}
    >
      {note.cite ? <div className="mn-cite">{note.cite}</div> : null}
      <p className="mn-body" style={{ fontSize: note.size ?? 17 }}>
        {note.body}
      </p>
      {note.aside ? <p className="mn-aside">{note.aside}</p> : null}
    </aside>
  );
}

// ============================================================
//  <Marginalia> — public component
// ============================================================
export function Marginalia({
  notes,
  hideBelow = 1180,
  /** Force the editor on/off. Defaults to import.meta.env.DEV. */
  editable,
  /** localStorage key for in-dev edits. */
  storageKey = "mn-edit",
}: {
  notes: MarginNote[];
  hideBelow?: number;
  editable?: boolean;
  storageKey?: string;
}) {
  const devDefault =
    typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;
  const canEdit = editable ?? !!devDefault;

  return (
    <>
      <MarginaliaStyle />
      {canEdit ? (
        <MarginaliaEditable notes={notes} hideBelow={hideBelow} storageKey={storageKey} />
      ) : (
        <MarginaliaStatic notes={notes} hideBelow={hideBelow} />
      )}
    </>
  );
}

// ---- Static (production) renderer ----
function MarginaliaStatic({ notes, hideBelow }: { notes: MarginNote[]; hideBelow: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const measure = () => {
      const host = ref.current?.parentElement;
      if (!host) return;
      setCenter(host.clientWidth / 2);
      setVisible(window.innerWidth >= hideBelow);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [hideBelow]);

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
      {visible &&
        notes.map((n) => <NoteView key={n.id} note={n} centerOffset={center} />)}
    </div>
  );
}

// ============================================================
//  Dev-only drag-to-place editor
// ============================================================
function MarginaliaEditable({
  notes: initial,
  hideBelow,
  storageKey,
}: {
  notes: MarginNote[];
  hideBelow: number;
  storageKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState(0);
  const [on, setOn] = useState(false);
  const [notes, setNotes] = useState<MarginNote[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw);
      } catch {/* ignore */}
    }
    return initial;
  });
  const [sel, setSel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const host = ref.current?.parentElement;
      if (host) setCenter(host.clientWidth / 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(notes)); } catch {/* ignore */}
  }, [notes, storageKey]);

  const update = useCallback((id: string, patch: Partial<MarginNote>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const onNotePointerDown = (e: React.PointerEvent, n: MarginNote) => {
    if (!on) return;
    e.preventDefault();
    e.stopPropagation();
    setSel(n.id);
    drag.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    update(d.id, {
      x: Math.round(d.ox + (e.clientX - d.sx)),
      top: Math.round(d.oy + (e.clientY - d.sy)),
    });
  };
  const onPointerUp = () => { drag.current = null; };

  const addNote = () => {
    const id = "n" + Math.random().toString(36).slice(2, 7);
    const n: MarginNote = { id, cite: "New ref", body: "double-click to edit", aside: "", top: 200, x: -640, width: 210, color: "ink" };
    setNotes((p) => [...p, n]);
    setSel(id);
  };
  const del = (id: string) => { setNotes((p) => p.filter((n) => n.id !== id)); setSel(null); };

  const copyJSX = async () => {
    const body = notes
      .map((n) => {
        const parts: string[] = [`id: ${JSON.stringify(n.id)}`];
        if (n.cite) parts.push(`cite: ${JSON.stringify(n.cite)}`);
        parts.push(`body: ${JSON.stringify(n.body)}`);
        if (n.aside) parts.push(`aside: ${JSON.stringify(n.aside)}`);
        parts.push(`top: ${n.top}`, `x: ${n.x}`);
        if (n.width && n.width !== 210) parts.push(`width: ${n.width}`);
        if (n.rotation != null) parts.push(`rotation: ${n.rotation}`);
        if (n.color && n.color !== "ink") parts.push(`color: ${JSON.stringify(n.color)}`);
        if (n.size && n.size !== 17) parts.push(`size: ${n.size}`);
        return `  { ${parts.join(", ")} },`;
      })
      .join("\n");
    const out = `import type { MarginNote } from "./Marginalia";\n\nexport const HOME_NOTES: MarginNote[] = [\n${body}\n];\n`;
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {/* ignore */}
  };

  const selected = notes.find((n) => n.id === sel) || null;

  return (
    <>
      <div
        ref={ref}
        style={{ position: "absolute", inset: 0, pointerEvents: on ? "auto" : "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={() => setSel(null)}
      >
        {notes.map((n) => (
          <NoteView
            key={n.id}
            note={n}
            centerOffset={center}
            selected={on && sel === n.id}
            editing={on}
            onPointerDown={(e) => onNotePointerDown(e, n)}
          />
        ))}
      </div>

      {/* Dev toolbar — fixed, never part of the page output */}
      <MarginaliaToolbar
        on={on}
        setOn={setOn}
        count={notes.length}
        selected={selected}
        update={update}
        addNote={addNote}
        del={del}
        copyJSX={copyJSX}
        copied={copied}
        reset={() => { setNotes(initial); setSel(null); }}
      />
    </>
  );
}

function MarginaliaToolbar(props: {
  on: boolean;
  setOn: (v: boolean) => void;
  count: number;
  selected: MarginNote | null;
  update: (id: string, patch: Partial<MarginNote>) => void;
  addNote: () => void;
  del: (id: string) => void;
  copyJSX: () => void;
  copied: boolean;
  reset: () => void;
}) {
  const { on, setOn, count, selected, update, addNote, del, copyJSX, copied, reset } = props;
  const box: React.CSSProperties = {
    position: "fixed", left: 16, bottom: 16, zIndex: 9999,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12,
  };
  const panel: React.CSSProperties = {
    background: "var(--card, #FCF8F0)", color: "var(--ink, #1A1814)",
    border: "1.5px solid var(--ink, #1A1814)", borderRadius: 12,
    padding: 12, width: 280, boxShadow: "0 10px 30px -14px rgba(0,0,0,0.4)",
    display: "flex", flexDirection: "column", gap: 10,
  };
  const row: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center" };
  const btn: React.CSSProperties = {
    border: "1px solid var(--ink,#1A1814)", background: "transparent",
    borderRadius: 8, padding: "5px 10px", cursor: "pointer", font: "inherit", color: "inherit",
  };
  const btnSolid: React.CSSProperties = { ...btn, background: "var(--ink,#1A1814)", color: "var(--paper,#F7F2E8)" };

  if (!on) {
    return (
      <div style={box}>
        <button style={btnSolid} onClick={() => setOn(true)}>✎ Margins ({count})</button>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={panel}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <strong style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14 }}>Margin notes</strong>
          <button style={btn} onClick={() => setOn(false)}>done</button>
        </div>

        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              style={{ ...btn, cursor: "text", width: "100%" }}
              value={selected.cite ?? ""}
              placeholder="cite (small label)"
              onChange={(e) => update(selected.id, { cite: e.target.value })}
            />
            <textarea
              style={{ ...btn, cursor: "text", width: "100%", minHeight: 50, resize: "vertical" }}
              value={selected.body}
              placeholder="body"
              onChange={(e) => update(selected.id, { body: e.target.value })}
            />
            <textarea
              style={{ ...btn, cursor: "text", width: "100%", minHeight: 34, resize: "vertical" }}
              value={selected.aside ?? ""}
              placeholder="aside (fainter line)"
              onChange={(e) => update(selected.id, { aside: e.target.value })}
            />
            <div style={row}>
              {MARGIN_INKS.map((ink) => (
                <button
                  key={ink.id}
                  title={ink.label}
                  onClick={() => update(selected.id, { color: ink.id })}
                  style={{
                    width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                    background: ink.light,
                    border: selected.color === ink.id ? "2px solid var(--ink,#1A1814)" : "1px solid rgba(0,0,0,0.2)",
                  }}
                />
              ))}
            </div>
            <label style={{ ...row, justifyContent: "space-between" }}>
              size
              <input type="range" min={12} max={26} value={selected.size ?? 17}
                onChange={(e) => update(selected.id, { size: +e.target.value })} />
            </label>
            <label style={{ ...row, justifyContent: "space-between" }}>
              rotate
              <input type="range" min={-12} max={12} step={0.5} value={selected.rotation ?? 0}
                onChange={(e) => update(selected.id, { rotation: +e.target.value })} />
            </label>
            <label style={{ ...row, justifyContent: "space-between" }}>
              width
              <input type="range" min={120} max={320} value={selected.width ?? 210}
                onChange={(e) => update(selected.id, { width: +e.target.value })} />
            </label>
            <div style={row}>
              <span style={{ opacity: 0.6 }}>x {selected.x} · y {selected.top}</span>
              <button style={{ ...btn, marginLeft: "auto", color: "var(--mn-ink-terracotta)" }} onClick={() => del(selected.id)}>delete</button>
            </div>
          </div>
        ) : (
          <div style={{ opacity: 0.65, lineHeight: 1.5 }}>
            Drag any note to place it. Click to select &amp; edit. Then copy the JSX into{" "}
            <code>marginalia-home-notes.ts</code>.
          </div>
        )}

        <div style={{ ...row, flexWrap: "wrap" }}>
          <button style={btn} onClick={addNote}>+ add</button>
          <button style={btn} onClick={reset}>reset</button>
          <button style={btnSolid} onClick={copyJSX}>{copied ? "copied ✓" : "copy JSX"}</button>
        </div>
      </div>
    </div>
  );
}
