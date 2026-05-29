import type { MarginNote } from "./Marginalia";

// Hand-placed margin notes for the home page (/).
//
// Edit positions visually: run the dev server, click "✎ Margins" bottom-left,
// drag notes where they look right at a wide viewport, then "Copy JSX" and
// paste the array back over this one.
//
// Keep bodies SHORT — handwriting in a 210px gutter wants a punchy line or
// two, not a full statutory paragraph. The cite is the small label; the body
// is the readable hook; the aside is the wry footnote.

export const HOME_NOTES: MarginNote[] = [
  // tops shifted below the navy eagle hero (~first 1000px) so handwriting lands
  // on parchment, not dark hero. Fine-tune live with the dev ✎ Margins editor.
  { id: "n_ix",   cite: "Amend. IX", body: "Rights not listed here are still yours.", aside: "(does most of what people think the 10th does.)", top: 1180, x: 540,  color: "terracotta" },
  { id: "n_hab",  cite: "Art. I § 9", body: "The Writ of Habeas Corpus shall not be suspended —", aside: "(older than the Constitution it sits inside.)", top: 1540, x: -680, color: "ink" },
  { id: "n_242",  cite: "18 U.S.C. § 242", body: "Deprivation of rights under color of law.", aside: "→ the operative word is willfully.", top: 1900, x: 560,  color: "sage" },
  { id: "n_1681", cite: "15 U.S.C. § 1681j", body: "One free credit report every 12 months.", aside: "(the statute few people ever cite.)", top: 2260, x: -690, color: "ochre" },
  { id: "n_1983", cite: "42 U.S.C. § 1983", body: "Every person who, under color of law, deprives another of their rights, shall be liable.", aside: "(passed 1871. Slept 90 years. Monroe v. Pape woke it.)", top: 2620, x: 540,  color: "terracotta" },
];
