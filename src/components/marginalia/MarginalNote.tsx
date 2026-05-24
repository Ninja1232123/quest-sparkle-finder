// ===========================================================
// MarginalNote — handwritten side annotations.
//
// The brand-name made literal. Each note is a real, lesser-cited
// right or statute, drifting in the page gutters like a careful
// reader's marginalia. ALL-CAPS mono cite, statutory text in
// Fraunces italic, optional fainter aside underneath.
//
// USAGE:
//   <MarginalNotes items={[
//     { idx: 0, side: "right", top: 280 },
//     { idx: 4, side: "left",  top: 940 },
//   ]} />
//
// The parent <main> must be position:relative (most are by default).
// Hidden automatically below 1100px viewport. Toggleable via Tweaks
// (data-margins="off" on <html>).
// ===========================================================

export type MarginalNoteData = {
  cite: string;
  body: string;
  aside?: string;
};

export const MARGIN_NOTES: MarginalNoteData[] = [
  {
    cite: "Amend. IX",
    body:
      "The enumeration in the Constitution, of certain rights, shall not be construed to deny or disparage others retained by the people.",
    aside:
      "(litigated rarely. Read on its own terms, it does most of what people think the 10th does.)",
  },
  {
    cite: "Amend. III",
    body:
      "No Soldier shall, in time of peace be quartered in any house, without the consent of the Owner, nor in time of war, but in a manner to be prescribed by law.",
    aside: "(invoked exactly once at the appellate level — Engblom v. Carey, 1982.)",
  },
  {
    cite: "Art. I § 9, cl. 2",
    body:
      "The Privilege of the Writ of Habeas Corpus shall not be suspended, unless when in Cases of Rebellion or Invasion the public Safety may require it.",
    aside: "(The Great Writ. Older than the Constitution it sits inside.)",
  },
  {
    cite: "18 U.S.C. § 242",
    body:
      "Whoever, under color of any law, statute, ordinance, regulation, or custom, willfully subjects any person … to the deprivation of any rights, privileges, or immunities secured or protected by the Constitution …",
    aside: "→ the operative word is willfully.",
  },
  {
    cite: "26 U.S.C. § 7521(a)(1)",
    body:
      "Any officer or employee of the Internal Revenue Service in connection with any in-person interview … shall, upon advance request of such taxpayer, allow the taxpayer to make an audio recording of such interview at the taxpayer's own expense and with the taxpayer's own equipment.",
    aside: "(the IRS can be recorded. Few taxpayers know this.)",
  },
  {
    cite: "Art. I § 9, cl. 3",
    body: "No Bill of Attainder or ex post facto Law shall be passed.",
    aside: "(twenty words. Two foundational doctrines.)",
  },
  {
    cite: "15 U.S.C. § 1681j(a)(1)",
    body:
      "Each consumer reporting agency … shall make all disclosures pursuant to section 1681g of this title once during any 12-month period upon request of the consumer and without charge to the consumer.",
    aside: "(the statutory basis for a free annual credit report.)",
  },
  {
    cite: "17 U.S.C. § 107",
    body:
      "The fair use of a copyrighted work … for purposes such as criticism, comment, news reporting, teaching … is not an infringement of copyright.",
    aside: "(four factors, no bright line. The factors are listed in the same section.)",
  },
  {
    cite: "42 U.S.C. § 1983",
    body:
      "Every person who, under color of any statute … subjects … any citizen of the United States … to the deprivation of any rights, privileges, or immunities secured by the Constitution and laws, shall be liable to the party injured …",
    aside:
      "(passed in 1871. Sat largely unused for ninety years. Then Monroe v. Pape in 1961 woke it up.)",
  },
  {
    cite: "14 C.F.R. § 91.3(a)",
    body:
      "The pilot in command of an aircraft is directly responsible for, and is the final authority as to, the operation of that aircraft.",
    aside: "(the only statutory grant of absolute authority left on the books.)",
  },
  {
    cite: "Art. IV § 2, cl. 1",
    body:
      "The Citizens of each State shall be entitled to all Privileges and Immunities of Citizens in the several States.",
    aside: "(the right to travel between states, anchored here — see Saenz v. Roe.)",
  },
  {
    cite: "31 U.S.C. § 1341",
    body:
      "An officer or employee of the United States Government … may not make or authorize an expenditure or obligation exceeding an amount available in an appropriation …",
    aside: "(the Antideficiency Act. The actual reason for government shutdowns.)",
  },
  {
    cite: "Amend. V",
    body: "…nor shall private property be taken for public use, without just compensation.",
    aside: "(the Takings Clause. Smaller than most people think. Wider than they wish.)",
  },
  {
    cite: "5 U.S.C. § 552(a)",
    body:
      "Each agency shall make available to the public information as follows … any person has a right to obtain access to … agency records …",
    aside: "(the Freedom of Information Act. Fifty-eight years old.)",
  },
  {
    cite: "Amend. XIV § 1",
    body:
      "All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside.",
    aside: "(birthright citizenship. The first sentence of the most-litigated amendment.)",
  },
  {
    cite: "U.C.C. § 1-103(a)",
    body:
      "The Uniform Commercial Code must be liberally construed and applied to promote its underlying purposes and policies …",
    aside: "(commercial law's mood ring.)",
  },
];

type Side = "left" | "right";

type MarginalNoteProps = {
  idx: number;
  side?: Side;
  /** Distance from top of the positioned ancestor (px or any CSS length). */
  top: number | string;
};

export function MarginalNote({ idx, side = "left", top }: MarginalNoteProps) {
  const note = MARGIN_NOTES[idx % MARGIN_NOTES.length];
  if (!note) return null;
  // Deterministic per-index tilt: -2deg .. +2deg
  const tilt = ((idx * 37) % 5) - 2;

  return (
    <aside
      className={`margin-note ${side === "right" ? "right" : "left"}`}
      style={{
        top: typeof top === "number" ? `${top}px` : top,
        transform: `rotate(${tilt}deg)`,
      }}
      data-cite={note.cite}
      aria-hidden="true"
    >
      <div className="mn-bar" />
      <div className="mn-cite">{note.cite}</div>
      <p className="mn-body">{note.body}</p>
      {note.aside ? <p className="mn-aside">{note.aside}</p> : null}
    </aside>
  );
}

type MarginalNotesProps = {
  items: { idx: number; side?: Side; top: number | string }[];
};

export function MarginalNotes({ items }: MarginalNotesProps) {
  return (
    <>
      {items.map((it, i) => (
        <MarginalNote key={i} idx={it.idx} side={it.side} top={it.top} />
      ))}
    </>
  );
}
