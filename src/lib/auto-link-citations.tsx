import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { DocCitationRow } from "@/lib/documents.functions";

// Span-driven inline citation renderer.
//
// Each DocCitationRow comes from citation_edges and carries the byte span
// (span_start/end) into body_text where the indexer found the cite. We render a
// [start, end) slice of body_text and drop a chip exactly over each span:
//   • resolved (to_identifier set) → an accent <Link> to the target document;
//   • unresolved (Pub. L. / Stat. / case refs we don't host) → a muted,
//     monospace chip with the full cite as a tooltip.
// Plain text between chips gets <mark> search highlighting and light cleanup of
// flattening artifacts (<br>, " | | "). No re-scanning of the text — placement
// is deterministic from the stored offsets, so nothing drifts.

const TYPE_LABEL: Record<string, string> = {
  usc: "U.S. Code",
  cfr: "CFR",
  pub_l: "Public Law",
  stat: "Statutes at Large",
  eo: "Executive Order",
  irm: "IRM",
  tfm: "TFM",
  ucc: "UCC",
  const: "Constitution",
  scotus: "Supreme Court",
  sct: "Supreme Court",
  fed_app: "Federal case",
  fed_supp: "Federal case",
  treas_reg: "Treasury Reg.",
  td: "Treasury Decision",
  rev_proc: "Rev. Proc.",
  rev_rul: "Rev. Rul.",
  fed_reg: "Federal Register",
  led: "Lawyers' Edition",
};

type Chip = { s: number; e: number; cite: DocCitationRow };

function renderChip(c: DocCitationRow, label: string, key: number): ReactNode {
  if (c.to_identifier) {
    return (
      <Link
        key={key}
        to="/code/$"
        params={{ _splat: c.to_identifier.replace(/^\//, "") }}
        className="font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
        title={`Jump to ${c.target_section_label ?? c.to_identifier}`}
      >
        {label}
      </Link>
    );
  }
  const kind = TYPE_LABEL[c.target_type] ?? "Citation";
  return (
    <span
      key={key}
      className="cursor-help rounded-sm bg-muted/50 px-0.5 font-mono text-[0.9em] text-foreground/55 decoration-dotted underline underline-offset-2"
      title={`${kind}: ${c.target_cite} — not in the library yet`}
    >
      {label}
    </span>
  );
}

export function renderDecorated(
  body: string,
  start: number,
  end: number,
  citations: DocCitationRow[],
  markRe: RegExp | null,
): ReactNode {
  // Collect the chips that fall inside this slice; sort earliest-first, longest
  // wins, drop overlaps.
  const chips: Chip[] = [];
  for (const c of citations) {
    if (c.span_start == null || c.span_end == null) continue;
    if (c.span_start >= start && c.span_end <= end && c.span_end > c.span_start) {
      chips.push({ s: c.span_start, e: c.span_end, cite: c });
    }
  }
  chips.sort((a, b) => a.s - b.s || b.e - a.e);
  const kept: Chip[] = [];
  let lastEnd = start;
  for (const ch of chips) {
    if (ch.s >= lastEnd) {
      kept.push(ch);
      lastEnd = ch.e;
    }
  }

  const nodes: ReactNode[] = [];
  let key = 0;

  const pushPlain = (s: number, e: number) => {
    if (e <= s) return;
    const cleaned = body
      .slice(s, e)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s*\|(?:\s*\|)+\s*/g, " ") // " | | " table-cell artifacts
      .replace(/\s+\|\s+/g, " ")
      .replace(/[ \t]{3,}/g, "  ");
    if (!cleaned) return;
    if (!markRe) {
      nodes.push(cleaned);
      return;
    }
    const flags = markRe.flags.replace("g", "");
    const splitRe = new RegExp(markRe.source, "g" + flags);
    const testRe = new RegExp(`^(?:${markRe.source})$`, flags);
    for (const part of cleaned.split(splitRe)) {
      if (!part) continue;
      if (testRe.test(part)) {
        nodes.push(
          <mark key={key++} className="bg-highlight text-foreground rounded-sm px-0.5">
            {part}
          </mark>,
        );
      } else {
        nodes.push(part);
      }
    }
  };

  let cursor = start;
  for (const ch of kept) {
    pushPlain(cursor, ch.s);
    nodes.push(renderChip(ch.cite, body.slice(ch.s, ch.e), key++));
    cursor = ch.e;
  }
  pushPlain(cursor, end);
  return <>{nodes}</>;
}
