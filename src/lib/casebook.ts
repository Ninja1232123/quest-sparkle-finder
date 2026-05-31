// ── Casebook: marginalia notes + case files ────────────────────────────────
// The note-compository. Two device-local stores (localStorage, nothing leaves
// the browser — same privacy model as marginalia + the compare shelf):
//
//   marginalia.notes.v2:{identifier}  ->  Record<paraIndex, NoteRecord>
//        a private note pinned to one paragraph, carrying a snapshot of the
//        citation it was written beside (so a case can show the cite without
//        re-fetching every document).
//
//   casebook.cases.v1                 ->  Record<caseId, CaseRecord>
//        a named case = an ORDERED bag of references to notes. Membership and
//        order live here; the note text/citation lives with the note. A note
//        is "in" a case iff the case lists its ref. The case page resolves each
//        ref back to its note at render and lets the user drag them into the
//        order that reads right — a citation-backed rough draft, arranged to
//        taste, ready to translate into a proper pleading.
//
// Local-first by design (cloud sync is a later Pro upgrade). Not legal advice —
// it's the user's own words, on the record, with the law to back them.
import { useCallback, useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

/** A snapshot of the law a note was written beside, captured at save time. */
export type NoteCite = {
  identifier: string; // "/usc/title-4/section-3"
  sourceCode: string; // "usc"
  sectionLabel: string; // "§ 3"
  heading: string; // "Use of flag for advertising purposes; mutilation of flag"
  paraIndex: number; // which operative paragraph the note hangs on
};

export type NoteRecord = {
  text: string;
  cite: NoteCite;
  createdAt: number;
  updatedAt: number;
};

/** A reference from a case to one note. (identifier + paraIndex is stable.) */
export type CaseItemRef = { identifier: string; paraIndex: number };

export type CaseRecord = {
  id: string;
  name: string;
  createdAt: number;
  items: CaseItemRef[]; // user-ordered
};

// ── Keys ──────────────────────────────────────────────────────────────────--

const NOTES_V1 = (id: string) => `marginalia.notes.v1:${id}`;
const NOTES_V2 = (id: string) => `marginalia.notes.v2:${id}`;
const CASES_KEY = "casebook.cases.v1";

export const refId = (r: CaseItemRef) => `${r.identifier}#${r.paraIndex}`;
export const sameRef = (a: CaseItemRef, b: CaseItemRef) =>
  a.identifier === b.identifier && a.paraIndex === b.paraIndex;

function now() {
  return typeof performance !== "undefined" ? Date.now() : Date.now();
}
function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

// ── Note store (per document) ────────────────────────────────────────────────
// Reads v2; lazily migrates a v1 doc (Record<idx,string>) into v2 using the
// document's live metadata (so the citation snapshot is accurate). The reader
// owns this hook because only it knows the section label / heading.

function readNotes(identifier: string): Record<string, NoteRecord> {
  try {
    const raw = localStorage.getItem(NOTES_V2(identifier));
    if (raw) return JSON.parse(raw) as Record<string, NoteRecord>;
  } catch {
    /* ignore */
  }
  return {};
}

export function useMarginalia(meta: {
  identifier: string;
  sourceCode: string;
  sectionLabel: string;
  heading: string;
}) {
  const { identifier, sourceCode, sectionLabel, heading } = meta;
  const [notes, setNotes] = useState<Record<string, NoteRecord>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let loaded = readNotes(identifier);
    // one-time migration from the old text-only v1 store.
    if (Object.keys(loaded).length === 0) {
      try {
        const rawV1 = localStorage.getItem(NOTES_V1(identifier));
        if (rawV1) {
          const v1 = JSON.parse(rawV1) as Record<string, string>;
          const t = now();
          const migrated: Record<string, NoteRecord> = {};
          for (const [idx, text] of Object.entries(v1)) {
            if (typeof text !== "string" || !text.trim()) continue;
            migrated[idx] = {
              text,
              cite: { identifier, sourceCode, sectionLabel, heading, paraIndex: Number(idx) },
              createdAt: t,
              updatedAt: t,
            };
          }
          if (Object.keys(migrated).length) {
            localStorage.setItem(NOTES_V2(identifier), JSON.stringify(migrated));
            loaded = migrated;
          }
        }
      } catch {
        /* ignore */
      }
    }
    setNotes(loaded);
    setHydrated(true);
  }, [identifier, sourceCode, sectionLabel, heading]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const key = NOTES_V2(identifier);
      if (Object.keys(notes).length > 0) localStorage.setItem(key, JSON.stringify(notes));
      else localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [notes, hydrated, identifier]);

  const setNote = useCallback(
    (idx: number, text: string) =>
      setNotes((prev) => {
        const t = text.trim();
        const next = { ...prev };
        if (!t) {
          delete next[idx];
          return next;
        }
        const existing = next[idx];
        const tstamp = now();
        next[idx] = existing
          ? { ...existing, text: t, updatedAt: tstamp }
          : {
              text: t,
              cite: { identifier, sourceCode, sectionLabel, heading, paraIndex: idx },
              createdAt: tstamp,
              updatedAt: tstamp,
            };
        return next;
      }),
    [identifier, sourceCode, sectionLabel, heading],
  );

  const removeNote = useCallback(
    (idx: number) =>
      setNotes((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      }),
    [],
  );

  return { notes, hydrated, setNote, removeNote, count: Object.keys(notes).length };
}

/** Resolve one note (text + cite) by reference — used by the case page. */
export function loadNote(ref: CaseItemRef): NoteRecord | null {
  const all = readNotes(ref.identifier);
  return all[ref.paraIndex] ?? null;
}

// ── Cases store (global) ─────────────────────────────────────────────────────

function readCases(): Record<string, CaseRecord> {
  try {
    const raw = localStorage.getItem(CASES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CaseRecord>;
  } catch {
    /* ignore */
  }
  return {};
}

export function useCases() {
  const [cases, setCases] = useState<Record<string, CaseRecord>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCases(readCases());
    setHydrated(true);
    // keep in sync if another tab edits the casebook
    const onStorage = (e: StorageEvent) => {
      if (e.key === CASES_KEY) setCases(readCases());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CASES_KEY, JSON.stringify(cases));
    } catch {
      /* ignore */
    }
  }, [cases, hydrated]);

  const list = useCallback(
    (): CaseRecord[] => Object.values(cases).sort((a, b) => b.createdAt - a.createdAt),
    [cases],
  );

  const create = useCallback((name: string): string => {
    const id = newId();
    setCases((prev) => ({ ...prev, [id]: { id, name: name.trim() || "Untitled case", createdAt: now(), items: [] } }));
    return id;
  }, []);

  const rename = useCallback(
    (id: string, name: string) =>
      setCases((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], name: name.trim() || prev[id].name } } : prev)),
    [],
  );

  const remove = useCallback(
    (id: string) =>
      setCases((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    [],
  );

  const addItem = useCallback(
    (id: string, ref: CaseItemRef) =>
      setCases((prev) => {
        const c = prev[id];
        if (!c || c.items.some((i) => sameRef(i, ref))) return prev;
        return { ...prev, [id]: { ...c, items: [...c.items, ref] } };
      }),
    [],
  );

  const removeItem = useCallback(
    (id: string, ref: CaseItemRef) =>
      setCases((prev) => {
        const c = prev[id];
        if (!c) return prev;
        return { ...prev, [id]: { ...c, items: c.items.filter((i) => !sameRef(i, ref)) } };
      }),
    [],
  );

  const reorder = useCallback(
    (id: string, items: CaseItemRef[]) =>
      setCases((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], items } } : prev)),
    [],
  );

  /** Which cases contain this note. */
  const casesForRef = useCallback(
    (ref: CaseItemRef): CaseRecord[] => Object.values(cases).filter((c) => c.items.some((i) => sameRef(i, ref))),
    [cases],
  );

  /** Tag/untag a note against a set of case ids (used on note save). */
  const syncNote = useCallback(
    (ref: CaseItemRef, caseIds: string[]) =>
      setCases((prev) => {
        const next: Record<string, CaseRecord> = {};
        const want = new Set(caseIds);
        for (const [id, c] of Object.entries(prev)) {
          const has = c.items.some((i) => sameRef(i, ref));
          if (want.has(id) && !has) next[id] = { ...c, items: [...c.items, ref] };
          else if (!want.has(id) && has) next[id] = { ...c, items: c.items.filter((i) => !sameRef(i, ref)) };
          else next[id] = c;
        }
        return next;
      }),
    [],
  );

  return {
    cases,
    hydrated,
    list,
    create,
    rename,
    remove,
    addItem,
    removeItem,
    reorder,
    casesForRef,
    syncNote,
    get: (id: string): CaseRecord | undefined => cases[id],
  };
}
