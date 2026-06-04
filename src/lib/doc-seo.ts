// SEO meta for a single corpus document (the /code/$ route — millions of pages).
//
// The whole game on these pages is the <title>: it must lead with the citation
// in the form people actually *search* and type, not a brand or a hierarchy
// dump. For statutes that means the volume/title number is fused into the
// citation up front — "26 U.S.C. § 1", not "U.S.C. § 1 … Title 26 …". The plain
// section name follows, then the destination brand. Everything else (the
// title/chapter/subchapter chain) belongs in the description or on-page, never
// in the <title> where it pushes the searchable part past Google's ~60-char cut.
//
// Formula:  {searchable citation} — {plain section name} · Self-Law
// Example:  26 U.S.C. § 1 — Tax imposed · Self-Law

import type { DocumentRow } from "./documents.functions";
import { STATE_NAMES, sourceMeta, sourceName } from "./source-groups";

export const SITE_BRAND = "Self-Law";

// A title comfortably inside Google's display cut once " · Self-Law" (11 chars)
// is appended. The citation is never trimmed — it's the searchable part — so we
// only ever shorten the trailing section name to fit.
const TITLE_MAX = 65;

// Pull a leading number out of a parent_label crumb, e.g.
//   "Title 26 - INTERNAL REVENUE CODE · …"  → "26"   (U.S.C. / C.F.R.)
//   "Title 5A - …"                          → "5A"
// Returns "" when there's no such number (firehose / model-code crumbs).
function titleNumber(parentLabel: string | null | undefined): string {
  const m = (parentLabel ?? "").match(/\bTitle\s+(\d+[A-Za-z]?)/i);
  return m ? m[1] : "";
}

// The bare section number, with the § sign and surrounding space stripped:
//   "§ 1530" → "1530"   "§ 2-207" → "2-207"   "§ 535.413" → "535.413"
function sectionNumber(sectionLabel: string | null | undefined): string {
  return (sectionLabel ?? "").replace(/^§\s*/, "").trim();
}

// A heading is only a real *name* when it adds something beyond the citation.
// Some sections were ingested with the bare number as their heading (UCC 9-203,
// CA codes, the Constitution's "Article I"), which would just echo the citation.
function meaningfulName(heading: string | null | undefined, secNum: string, sectionLabel: string | null | undefined): string {
  const h = (heading ?? "").trim();
  if (!h) return "";
  if (h === secNum) return ""; // heading is just "9-203"
  if (h === (sectionLabel ?? "").trim()) return ""; // heading echoes "Article I"
  if (h.replace(/^§\s*/, "").trim() === secNum) return ""; // "§ 9-203"
  return h;
}

// Per-source noun for the description ("the real statute, not a summary").
const SOURCE_NOUN: Record<string, string> = {
  cfr: "regulation",
  irm: "manual section",
  tfm: "manual section",
  const: "text",
  register: "notice",
  bill: "bill text",
};

export type DocSeo = {
  /** The searchable citation, e.g. "26 U.S.C. § 1". Never trimmed. */
  citation: string;
  /** The plain section name, e.g. "Tax imposed" (may be ""). */
  name: string;
  /** <title> — "{citation} — {name} · Self-Law", clamped to fit. */
  title: string;
  /** og:/twitter: title — same minus the brand suffix (og:site_name carries it). */
  ogTitle: string;
  /** Templated, keyword-rich meta description. */
  description: string;
};

// Build the searchable citation + plain name for a document. The citation form
// is per-source: statutes fuse the title/volume number up front; model codes and
// agency manuals carry their own prefix; states lead with the jurisdiction name.
export function docCitation(d: DocumentRow): { citation: string; name: string } {
  const src = d.source_code;
  const secNum = sectionNumber(d.section_label);
  const tnum = titleNumber(d.parent_label);
  const name = meaningfulName(d.heading, secNum, d.section_label);

  // Federal statutes & regulations: "{title} USC § {section}".
  if (src === "usc") {
    return { citation: tnum ? `${tnum} USC § ${secNum}` : `USC § ${secNum}`, name };
  }
  if (src === "cfr") {
    return { citation: tnum ? `${tnum} CFR § ${secNum}` : `CFR § ${secNum}`, name };
  }
  // Uniform Commercial Code: "UCC § 2-207" — the undotted form people type.
  if (src === "ucc") {
    return { citation: secNum ? `UCC § ${secNum}` : "UCC", name };
  }
  // Agency manuals already carry their own prefix in section_label ("IRM 1.1.1").
  if (src === "irm") {
    return { citation: d.section_label?.trim() || "IRM", name };
  }
  if (src === "tfm") {
    return { citation: `TFM ${d.section_label?.trim() ?? ""}`.trim() || "TFM", name };
  }
  if (src === "const") {
    const sl = d.section_label?.trim() || d.heading?.trim() || "";
    return { citation: sl ? `U.S. Const. ${sl}` : "U.S. Constitution", name };
  }

  // States lead with the jurisdiction so a section ranks for "<state> <topic>".
  // sourceMeta(state).short is the full state name. Most state scrapes leave
  // section_label null and fold the number into the heading ("§ 1200. Name." or
  // "Section 3901.621 — Name"), so pull the number out and fuse it into the
  // citation, leaving the rest as the plain name.
  if (src in STATE_NAMES) {
    const tag = sourceMeta(src).short; // full state name
    let stateSec = secNum;
    let stateName = name;
    if (!stateSec) {
      const hm = (d.heading ?? "").match(/^(?:§|Section)\s*([\w.\-]+)\s*(?:[.—–\-:]\s*(.*))?$/i);
      if (hm) {
        stateSec = hm[1];
        stateName = (hm[2] ?? "").trim().replace(/\.$/, "");
      }
    }
    const citation = stateSec ? `${tag} § ${stateSec}` : tag;
    return { citation, name: stateName };
  }

  // Everything else (bills, the Register, presidential papers, Statutes at
  // Large, compilations): "{short} {section_label}" with the heading as name.
  const tag = sourceMeta(src).short;
  const lead = d.section_label?.trim() ? `${tag} ${d.section_label.trim()}` : tag;
  return { citation: lead, name };
}

// Compose "{citation} — {name} · Self-Law", trimming only the name so the whole
// title fits comfortably under Google's cut. The citation is always preserved.
function clampTitle(citation: string, name: string): string {
  const suffix = ` · ${SITE_BRAND}`;
  if (!name) return `${citation}${suffix}`;
  const full = `${citation} — ${name}${suffix}`;
  if (full.length <= TITLE_MAX) return full;
  // Trim the name to fit, leaving room for the suffix and an ellipsis.
  const budget = TITLE_MAX - suffix.length - citation.length - 4; // " — " + "…"
  if (budget < 8) return `${citation}${suffix}`; // citation already long; drop the name
  return `${citation} — ${name.slice(0, budget).trimEnd()}…${suffix}`;
}

export function docSeo(d: DocumentRow): DocSeo {
  const { citation, name } = docCitation(d);
  const title = clampTitle(citation, name);
  const ogTitle = name ? `${citation} — ${name}` : citation;

  const noun = SOURCE_NOUN[d.source_code] ?? "statute";
  // "Part of the United States Code" reads right, but a bare state name doesn't
  // take "the" — "Part of New York law" instead of "Part of the New York".
  const corpus = d.source_code in STATE_NAMES
    ? `${sourceName(d.source_code)} law`
    : `the ${sourceName(d.source_code)}`;
  const description =
    `Read the full text of ${citation}${name ? ` (${name})` : ""}, with cross-references ` +
    `and citations — the real ${noun}, not a summary. Part of ${corpus} on ${SITE_BRAND}.`;

  return { citation, name, title, ogTitle, description };
}
