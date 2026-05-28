// Offset-preserving structural parse of a flattened legal body_text.
//
// The corpus stores each section's body as one (often newline-free) blob: the
// operative text, its enumerated subdivisions, and the OLRC apparatus
// (Editorial Notes, Statutory Notes, Executive Documents) all concatenated into
// a single string. citation_edges stores byte spans into this *exact* string,
// so everything here works in ORIGINAL body_text coordinates — we never mutate
// the string, only record [start, end) ranges — and those spans stay valid all
// the way through rendering. See CITATION_GAMEPLAN.md.

export type BodySegment = {
  kind: "operative" | "note";
  heading: string | null; // note heading, e.g. "Editorial Notes"; null for operative
  start: number; // content start offset into body_text
  end: number; // content end offset (exclusive)
};

export type LegalPara = {
  label: string | null; // "(a)", "(1)", "(ii)", or null for unlabeled text
  level: 0 | 1 | 2 | 3;
  start: number; // offset into body_text
  end: number; // offset into body_text (exclusive)
};

export function labelLevel(inner: string): 0 | 1 | 2 | 3 {
  if (/^\d+$/.test(inner)) return 2; // (1), (2), …
  if (/^(ii|iii|iv|vi{0,3}|ix|xi{0,3}|xiv|xv)$/i.test(inner)) return 3; // multi-char roman
  if (/^[a-z]$/i.test(inner)) return 1; // single letter (incl. i/v/x)
  return 0;
}

// The OLRC apparatus headings appear verbatim in USC bodies, after the
// operative text, in roughly this order. We split the blob at the first
// occurrence of each so the operative law reads on its own and the notes fold
// into collapsible panels. Other sources have no such convention (yet) — they
// fall through to a single operative segment.
const USC_NOTE_MARKERS = [
  "Statutory Notes and Related Subsidiaries",
  "Editorial Notes",
  "Executive Documents",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNoteMarkers(source: string, body: string): { index: number; end: number; heading: string }[] {
  if (source !== "usc") return [];
  const found: { index: number; end: number; heading: string }[] = [];
  for (const phrase of USC_NOTE_MARKERS) {
    // The phrase must sit on a boundary (start, whitespace, or sentence/paren
    // punctuation) and be followed by whitespace — distinctive enough that the
    // first match is the apparatus heading, not prose.
    const re = new RegExp(`(?:^|[\\s.;:)\\]])(${escapeRe(phrase)})(?=\\s)`);
    const m = re.exec(body);
    if (m) {
      const idx = m.index + (m[0].length - phrase.length);
      found.push({ index: idx, end: idx + phrase.length, heading: phrase });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

export function segmentBody(source: string, body: string): BodySegment[] {
  const markers = findNoteMarkers(source, body);
  if (markers.length === 0) {
    return [{ kind: "operative", heading: null, start: 0, end: body.length }];
  }
  const segs: BodySegment[] = [];
  if (markers[0].index > 0) {
    segs.push({ kind: "operative", heading: null, start: 0, end: markers[0].index });
  }
  for (let i = 0; i < markers.length; i++) {
    const contentStart = markers[i].end;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].index : body.length;
    if (contentEnd > contentStart) {
      segs.push({ kind: "note", heading: markers[i].heading, start: contentStart, end: contentEnd });
    }
  }
  return segs;
}

function trimRange(body: string, s: number, e: number): { s: number; e: number } {
  while (s < e && /\s/.test(body[s])) s++;
  while (e > s && /\s/.test(body[e - 1])) e--;
  return { s, e };
}

function skipWs(body: string, pos: number, limit: number): number {
  while (pos < limit && /\s/.test(body[pos])) pos++;
  return pos;
}

function readLabel(body: string, s: number, e: number): { label: string | null; level: 0 | 1 | 2 | 3; contentStart: number } {
  const head = body.slice(s, Math.min(e, s + 12));
  const m = head.match(/^\(([a-zA-Z0-9]{1,4})\)\s*/);
  if (!m) return { label: null, level: 0, contentStart: s };
  const level = labelLevel(m[1]);
  return { label: `(${m[1]})`, level: level || 1, contentStart: s + m[0].length };
}

// Long unstructured prose (a chapeau, a note body, a section with no
// subdivisions) is the actual "wall of text". Break it into visual paragraphs
// at sentence boundaries near a target length, never inside a citation span.
const SOFT_MAX = 700;
const SOFT_TARGET = 480;

function insideSpan(pos: number, spans?: { s: number; e: number }[]): boolean {
  if (!spans) return false;
  for (const sp of spans) if (pos > sp.s && pos < sp.e) return true;
  return false;
}

function pushSoftSplit(
  out: LegalPara[],
  body: string,
  s: number,
  e: number,
  spans?: { s: number; e: number }[],
): void {
  if (e - s <= SOFT_MAX) {
    out.push({ label: null, level: 0, start: s, end: e });
    return;
  }
  const text = body.slice(s, e);
  // A sentence/clause break: terminal punctuation + space + an opening capital,
  // quote, or paren. Conservative on purpose — better to under-split than to
  // chop mid-sentence.
  const re = /[.;:][)"”']?\s+(?=[A-Z("“'])/g;
  let segStart = s;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const absBreak = s + m.index + 1; // just past the terminal punctuation
    if (absBreak - segStart >= SOFT_TARGET && !insideSpan(absBreak, spans)) {
      out.push({ label: null, level: 0, start: segStart, end: absBreak });
      segStart = skipWs(body, absBreak, e);
    }
  }
  if (segStart < e) out.push({ label: null, level: 0, start: segStart, end: e });
}

// Split a [start, end) range of body_text into paragraphs, in original
// coordinates. Hard breaks at newlines, literal <br> tokens, and inline
// enumerators "(a)/(1)/(ii)"; long unlabeled runs are soft-split by sentence.
export function splitParagraphs(
  body: string,
  start: number,
  end: number,
  spans?: { s: number; e: number }[],
): LegalPara[] {
  const text = body.slice(start, end);
  const breaks = new Set<number>([start]);

  // newlines → break after the newline
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") breaks.add(start + i + 1);
  }
  // literal <br> artifacts (common in IRM) → treat as a line break
  const brRe = /<br\s*\/?>/gi;
  let b: RegExpExecArray | null;
  while ((b = brRe.exec(text)) !== null) breaks.add(start + b.index + b[0].length);

  // inline enumerators: "<non-space,non-paren><space>(x) " → break at the "("
  const enumRe = /[^\s(]\s+(\([a-zA-Z0-9]{1,4}\)\s)/g;
  let m: RegExpExecArray | null;
  while ((m = enumRe.exec(text)) !== null) {
    const parenIdx = m.index + m[0].indexOf(m[1]);
    breaks.add(start + parenIdx);
    enumRe.lastIndex = parenIdx + 1; // allow back-to-back enumerators
  }

  const sorted = Array.from(breaks)
    .filter((p) => p >= start && p < end)
    .sort((a, c) => a - c);

  const out: LegalPara[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const segS = sorted[i];
    const segE = i + 1 < sorted.length ? sorted[i + 1] : end;
    const t = trimRange(body, segS, segE);
    if (t.s >= t.e) continue; // blank line
    const { label, level, contentStart } = readLabel(body, t.s, t.e);
    if (label) {
      if (t.e > contentStart) out.push({ label, level, start: contentStart, end: t.e });
    } else {
      pushSoftSplit(out, body, t.s, t.e, spans);
    }
  }
  return out;
}
