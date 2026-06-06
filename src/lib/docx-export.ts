/* -----------------------------------------------------------------------------
   § DOCX export for the Document Builder. The PDF is the finished artifact; the
   .docx is the portable, still-editable copy — for the user who has to file in a
   system that wants Word, or who needs to keep working on it somewhere else.
   We carry the *structure* (caption, line numbering, numbered paragraphs, page
   numbers), not pixel fidelity — Word will reflow it, and that's fine.

   docx is heavy (~ a few hundred KB) and only needed on click, so it's imported
   dynamically. Browser-only: parses the contentEditable body with DOMParser and
   triggers a download via an object URL.
   --------------------------------------------------------------------------- */

// Structural mirror of builder.tsx's Spec — kept local so this module doesn't
// import from a route. Must stay in sync with the fields it reads.
export type DocxSpec = {
  court: string;
  plaintiff: string;
  defendant: string;
  caseNo: string;
  title: string;
  font: "times" | "century" | "courier";
  sizePt: number;
  spacing: number;
  align: "left" | "justify";
  marginIn: number;
  marginTopIn: number;
  lineNumbers: boolean;
  lineCount: number;
  paragraphNumbers: boolean;
  pageNumbers: boolean;
};

const DOCX_FONT: Record<DocxSpec["font"], string> = {
  times: "Times New Roman",
  century: "Century Schoolbook",
  courier: "Courier New",
};

// Split the editor's HTML into plain-text paragraphs. Each <p> (or <div>, which
// some browsers emit on Enter) becomes one paragraph; blank ones are dropped.
function bodyParagraphs(bodyHtml: string): string[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<body>${bodyHtml}</body>`, "text/html");
  const blocks = Array.from(doc.body.querySelectorAll("p, div"));
  const out: string[] = [];
  if (blocks.length) {
    for (const b of blocks) {
      const t = (b.textContent || "").replace(/ /g, " ").trim();
      if (t) out.push(t);
    }
  }
  // Fallback: no block elements at all — treat the whole thing as one paragraph.
  if (!out.length) {
    const t = (doc.body.textContent || "").trim();
    if (t) out.push(t);
  }
  return out;
}

export async function exportDocx(spec: DocxSpec, bodyHtml: string, fileName = "pleading.docx") {
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle,
    LineNumberRestartFormat,
    LevelFormat,
    PageNumber,
    Footer,
    convertInchesToTwip,
  } = docx;

  const font = DOCX_FONT[spec.font];
  const sizeHalfPt = spec.sizePt * 2; // docx sizes are in half-points
  const lineTwips = Math.round(spec.spacing * 240); // 240 = single line
  const NONE = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;

  // Court header — one centered, bold line per row of the textarea.
  const courtLines = spec.court.split("\n").map(
    (line) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, bold: true })],
      }),
  );

  // Parties block, mirrored from the on-screen caption: plaintiff / Plaintiff, /
  // v. / defendant / Defendant. on the left; case number + title on the right,
  // divided by a vertical rule (the left cell's right border).
  const partyLine = (text: string, indent = false) =>
    new Paragraph({
      indent: indent ? { left: convertInchesToTwip(1.5) } : undefined,
      children: [new TextRun(text)],
    });

  const captionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: {
              top: NONE,
              bottom: NONE,
              left: NONE,
              right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            },
            children: [
              partyLine(`${spec.plaintiff || "PLAINTIFF"},`),
              partyLine("Plaintiff,", true),
              partyLine("v."),
              partyLine(`${spec.defendant || "DEFENDANT"},`),
              partyLine("Defendant.", true),
            ],
          }),
          new TableCell({
            borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
            children: [
              new Paragraph({ children: [new TextRun(spec.caseNo)] }),
              new Paragraph({
                spacing: { before: lineTwips },
                children: [new TextRun({ text: spec.title.toUpperCase(), bold: true })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Body — numbered paragraphs reference a decimal numbering definition so Word
  // renumbers automatically if the user inserts or deletes one.
  const paras = bodyParagraphs(bodyHtml);
  const bodyChildren = paras.map(
    (text) =>
      new Paragraph({
        spacing: { line: lineTwips, lineRule: "auto" },
        alignment: spec.align === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        numbering: spec.paragraphNumbers ? { reference: "pleading-paras", level: 0 } : undefined,
        children: [new TextRun(text)],
      }),
  );

  const footers = spec.pageNumbers
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", size: sizeHalfPt - 2 }),
                new TextRun({ children: [PageNumber.CURRENT], size: sizeHalfPt - 2 }),
                new TextRun({ text: " of ", size: sizeHalfPt - 2 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: sizeHalfPt - 2 }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  const doc = new Document({
    styles: { default: { document: { run: { font, size: sizeHalfPt } } } },
    numbering: {
      config: [
        {
          reference: "pleading-paras",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.3) } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: {
              top: convertInchesToTwip(spec.marginTopIn),
              bottom: convertInchesToTwip(spec.marginIn),
              left: convertInchesToTwip(spec.marginIn),
              right: convertInchesToTwip(spec.marginIn),
            },
          },
          lineNumbers: spec.lineNumbers
            ? { countBy: 1, start: 1, restart: LineNumberRestartFormat.NEW_PAGE }
            : undefined,
        },
        footers,
        children: [
          ...courtLines,
          new Paragraph({ spacing: { before: lineTwips } }),
          captionTable,
          new Paragraph({ spacing: { before: lineTwips * 2 } }),
          ...bodyChildren,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
