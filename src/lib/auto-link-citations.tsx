import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { DocCitationRow } from "@/lib/documents.functions";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

// Inline citation auto-linker + defined-term glossary hover cards.
// Walks body text and renders <Link> for known outgoing citations and
// <HoverCard> for defined terms parsed from a sibling Definitions section.

type LinkMatch = { kind: "link"; start: number; end: number; identifier: string };
type GlossMatch = { kind: "gloss"; start: number; end: number; term: string; definition: string };
type Match = LinkMatch | GlossMatch;

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

function buildCitationMatches(text: string, citations: DocCitationRow[]): LinkMatch[] {
  const out: LinkMatch[] = [];
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
        out.push({ kind: "link", start: m.index, end: m.index + m[0].length, identifier: c.to_identifier });
      }
    }
  }
  return out;
}

// Parse a Definitions section body into a map of term (lowercase) → display definition.
export function parseGlossary(bodyText: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!bodyText) return map;
  // Match: "Term" means [definition until . or ;]
  // Handles: means, shall mean, refers to, includes, is defined as, has the meaning
  const re = /"([^"]{2,60})"\s+(?:shall\s+)?(?:mean[s]?|refer[s]?\s+to|include[s]?|is\s+defined\s+as|has\s+the\s+meaning)[^;.\n]{0,400}[;.]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyText)) !== null) {
    const term = m[1].trim();
    if (term.length < 2) continue;
    if (map.has(term.toLowerCase())) continue;
    map.set(term.toLowerCase(), m[0].replace(/\s+/g, " ").trim());
  }
  return map;
}

function buildGlossaryMatches(text: string, glossary: Map<string, string>): GlossMatch[] {
  const out: GlossMatch[] = [];
  for (const [key, definition] of glossary) {
    const escaped = escapeRe(key);
    // Case-sensitive to respect legal convention of capitalizing defined terms.
    // Capitalize first letter to match Title-Cased usages in the body.
    const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
    const capEscaped = escapeRe(capitalized);
    for (const pat of [escaped, capEscaped]) {
      const re = new RegExp(`(?<![\\w"])${pat}(?![\\w"])`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        out.push({ kind: "gloss", start: m.index, end: m.index + m[0].length, term: key, definition });
      }
    }
  }
  return out;
}

function deduplicateMatches(all: Match[]): Match[] {
  // Earliest-start, then longest-match; links beat gloss on tie; drop overlaps.
  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    // links take priority over gloss
    if (a.kind !== b.kind) return a.kind === "link" ? -1 : 1;
    return 0;
  });
  const filtered: Match[] = [];
  let lastEnd = -1;
  for (const m of all) {
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
  glossary?: Map<string, string>,
): ReactNode {
  const citMatches = buildCitationMatches(text, citations);
  const glossMatches = glossary ? buildGlossaryMatches(text, glossary) : [];
  const matches = deduplicateMatches([...citMatches, ...glossMatches]);

  const nodes: ReactNode[] = [];
  let key = 0;

  const pushText = (s: string) => {
    if (!s) return;
    if (!markRe) {
      nodes.push(s);
      return;
    }
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
    if (m.kind === "link") {
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
    } else {
      nodes.push(
        <HoverCard key={key++} openDelay={300} closeDelay={100}>
          <HoverCardTrigger asChild>
            <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground/50 transition-colors">
              {label}
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 text-sm leading-relaxed">
            <p className="mb-1 font-semibold text-foreground/80">{label}</p>
            <p className="text-muted-foreground">{m.definition}</p>
          </HoverCardContent>
        </HoverCard>,
      );
    }
    cursor = m.end;
  }
  pushText(text.slice(cursor));
  return <>{nodes}</>;
}
