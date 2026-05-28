// Display formatting for corpus breadcrumb labels.
//
// The raw `parent_label` in the corpus is a full breadcrumb that buries the
// title's name and repeats it on every child row, e.g. for CFR:
//   "Title 1 · General Provisions · Part 1 — Definitions (Chapter I – …)"
// On the front end that rendered as a bare "Title 1" node whose every part
// re-stated "General Provisions · …". We want the *title* to carry its name and
// each *part* to drop the repeated title name + the chapter parenthetical:
//   title:  "Title 1 — General Provisions"
//   part:   "Part 1 — Definitions"
//
// This is purely cosmetic. `parent_label` stays the drill key everywhere — we
// never mutate the data, only the label shown. Only CFR / IRM / TFM need
// reshaping (their hierarchy got split awkwardly on ingest); every other source
// already reads fine, so the default branch reproduces the prior behaviour.

export type TocLabels = {
  /** Stable grouping key — one TOC node per title. */
  titleKey: string;
  /** Node header, e.g. "Title 1 — General Provisions". */
  titleDisplay: string;
  /** Part row, e.g. "Part 1 — Definitions". */
  partDisplay: string;
};

// A trailing "(Chapter … )" context on a CFR part. Anchored on "(Chapter" so a
// legitimate earlier paren (e.g. "(Privacy Act)") is kept; greedy to the last
// ")" so nested parens like "(Chapter X – Dept. of Energy (General …))" strip
// whole. Only strips when it runs to the end of the string.
const CFR_CHAPTER_PAREN = /\s*\(Chapter\b[\s\S]*\)\s*$/;

const TFM_VOL_PART = /^TFM\s+Volume\s+([^,]+?)\s*,\s*Part\s+(.+)$/i;

export function formatTocLabels(source: string, parentLabel: string): TocLabels {
  const segs = parentLabel.split(" · ");

  if (source === "cfr" && segs.length >= 3) {
    // "Title N · <Title name> · Part M — <Part name> (Chapter …)"
    const titleNum = segs[0];
    const titleName = segs[1];
    const partRaw = segs.slice(2).join(" · ");
    return {
      titleKey: titleNum,
      titleDisplay: titleName ? `${titleNum} — ${titleName}` : titleNum,
      partDisplay: (partRaw.replace(CFR_CHAPTER_PAREN, "").trim() || "—"),
    };
  }

  if (source === "irm" && segs.length >= 3) {
    // "Part N · <Part name> · Chapter M. <Chapter name>"
    const partNum = segs[0];
    const partName = segs[1];
    const chapter = segs.slice(2).join(" · ");
    return {
      titleKey: partNum,
      titleDisplay: partName ? `${partNum} — ${partName}` : partNum,
      partDisplay: chapter || "—",
    };
  }

  if (source === "tfm") {
    // "TFM Volume V, Part N" → group by volume, with each part a child row.
    // (Volume/part names aren't in the corpus; "Part N" is the honest label.)
    const m = parentLabel.match(TFM_VOL_PART);
    if (m) {
      return {
        titleKey: `TFM Volume ${m[1]}`,
        titleDisplay: `Volume ${m[1]}`,
        partDisplay: `Part ${m[2]}`,
      };
    }
    return { titleKey: parentLabel, titleDisplay: parentLabel, partDisplay: "—" };
  }

  // Default — USC/UCC/Constitution/Statutes/etc. already read correctly. The
  // title is segment 1 (USC already carries its name: "Title 10 - ARMED
  // FORCES"); the part is everything after it. Matches the prior behaviour.
  const titleKey = segs[0] ?? parentLabel;
  return {
    titleKey,
    titleDisplay: titleKey,
    partDisplay: segs.length > 1 ? segs.slice(1).join(" · ") : "—",
  };
}

// One-line crumb for an opened group (a raw parent_label drill key): combines
// the cleaned title + part, e.g. "Title 1 — General Provisions · Part 1 —
// Definitions". Used in breadcrumbs, section headers, and search hits.
export function formatGroupCrumb(source: string, parentLabel: string): string {
  const { titleDisplay, partDisplay } = formatTocLabels(source, parentLabel);
  if (!partDisplay || partDisplay === "—") return titleDisplay;
  return `${titleDisplay} · ${partDisplay}`;
}
