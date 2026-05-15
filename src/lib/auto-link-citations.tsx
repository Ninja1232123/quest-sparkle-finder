import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { DocCitationRow } from "@/lib/documents.functions";

// Inline citation auto-linker.
// Walks the body text and substitutes <Link> for any in-text mention that
// matches a known outgoing citation. Uses the existing doc_citations map —
// we only link what the indexer has already resolved to a real document, so
// no false-positive deep links into things we don't have.

type Match = { start: number; end: number; identifier: string };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Patterns we recognize for a single section label, e.g. "25.981" or "1983":
 *   "§ 25.981", "§ 25.981(c)", "section 25.981(c)(2)", "sec. 1983"
 * If the label itself contains a "." or "-" (CFR / UCC style), we also accept
 * the bare form "25.981(c)" since it's unlikely to collide with regular prose.
 * Pure numeric labels like USC "1983" require an anchor word (§ / section / sec.)
 * to avoid linking every loose number.
 */
function patternsFor(label: string): RegExp[] {
  const lbl = escapeRe(label);
  const tail = `(?:\\([a-zA-Z0-9]{1,4}\\))*`;
  const pats: RegExp[] = [
    new RegExp(`§\\s*${lbl}${tail}`, "g"),
    new RegExp(`\\bsection\\s+${lbl}${tail}\\b`, "gi"),
    new RegExp(`\\bsec\\.?\\s+${lbl}${tail}\\b`, "gi"),
  ];
  if (/[.\-]/.test(label)) {
    pats.push(new RegExp(`(?<![\\w.])${lbl}${tail}(?![\\w.])`, "g"));
  }
  return pats;
}

function normalizeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip leading § and any leading "Sec."/"Section "
  let s = raw.replace(/^§\s*/, "").replace(/^sec(tion)?\.?\s+/i, "").trim();
  // Drop trailing punctuation
  s = s.replace(/[.,;:]+$/, "");
  // Drop a trailing parenthetical chain so we match the base; the regex tail
  // re-captures (a)(1) suffixes from the body.
  s = s.replace(/(\([a-zA-Z0-9]{1,4}\))+$/, "");
  return s.length >= 2 ? s : null;
}

function buildMatches(text: string, citations: DocCitationRow[]): Match[] {
  const out: Match[] = [];
  // De-dupe rule pairs so we don't scan the same regex twice when two citations
  // share a label.
  const seen = new Set<string>();
  for (const c of citations) {
    const label = normalizeLabel(c.target_section_label) ?? normalizeLabel(c.to_identifier.split("/").pop());
    if (!label) continue;
    const key = `${label}::${c.to_identifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const re of patternsFor(label)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        out.push({ start: m.index, end: m.index + m[0].length, identifier: c.to_identifier });
      }
    }
  }
  // Earliest-start, then longest-match wins; drop overlaps.
  out.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const filtered: Match[] = [];
  let lastEnd = -1;
  for (const m of out) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }
  return filtered;
}

export function linkifyAndHighlight(
  text: string,
  citations: DocCitationRow[],
  markRe: RegExp | null,
): ReactNode {
  const matches = buildMatches(text, citations);
  const nodes: ReactNode[] = [];
  let key = 0;

  const pushText = (s: string) => {
    if (!s) return;
    if (!markRe) {
      nodes.push(s);
      return;
    }
    // Use a fresh non-global regex for split + per-part tests so global state
    // doesn't corrupt subsequent calls.
    const flags = markRe.flags.replace("g", "");
    const splitRe = new RegExp(markRe.source, "g" + flags);
    const testRe = new RegExp(`^(?:${markRe.source})$`, flags);
    const parts = s.split(splitRe);
    for (const p of parts) {
      if (!p) continue;
      if (testRe.test(p)) {
        nodes.push(
          <mark key={key++} className="bg-highlight text-foreground rounded-sm px-0.5">{p}</mark>,
        );
      } else {
        nodes.push(p);
      }
    }
  };

  let cursor = 0;
  for (const m of matches) {
    pushText(text.slice(cursor, m.start));
    const label = text.slice(m.start, m.end);
    nodes.push(
      <Link
        key={key++}
        to="/code/$"
        params={{ _splat: m.identifier.replace(/^\//, "") }}
        className="font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
        title={`Jump to ${m.identifier}`}
      >
        {label}
      </Link>,
    );
    cursor = m.end;
  }
  pushText(text.slice(cursor));
  return <>{nodes}</>;
}