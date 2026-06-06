import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { Printer, FileText, Eye, Pencil, Download } from "lucide-react";

// Persistence keys — a refresh shouldn't wipe a half-drafted pleading.
const STORAGE_SPEC = "doc-builder-spec-v1";
const STORAGE_BODY = "doc-builder-body-v1";
const DEFAULT_BODY_HTML =
  "<p>Type your complaint here. Press Enter for a new numbered paragraph.</p>" +
  "<p>Each paragraph states one fact or allegation, in plain numbered order.</p>";

export const Route = createFileRoute("/builder")({
  component: Builder,
  head: () => ({
    meta: [
      { title: "Legal Filing Template Creator | Pro Se Court Forms | Self-Law" },
      {
        name: "description",
        content:
          "Draft your own court documents. Access our legal template creator to build structured filing documents backed by real state and federal citations.",
      },
      { property: "og:title", content: "Legal Document Builder · Self-Law" },
    ],
  }),
});

/* -----------------------------------------------------------------------------
   § The only parameters the user touches (per DOC_BUILDER_SPEC.md). Deliberately
   minimal: enough to make a court-presentable pleading, nothing else. Per-court
   formatting profiles (the moat) layer on later — for now the specs are manual.
   --------------------------------------------------------------------------- */
type Spec = {
  court: string;
  plaintiff: string;
  defendant: string;
  caseNo: string;
  title: string;
  font: "times" | "century" | "courier";
  sizePt: number;
  spacing: number; // line-height multiplier
  align: "left" | "justify";
  marginIn: number; // left / right / bottom
  marginTopIn: number; // top — usually larger, to leave room for the clerk stamp
  lineNumbers: boolean;
  lineCount: number;
  paragraphNumbers: boolean;
  pageNumbers: boolean;
};

const FONT_STACK: Record<Spec["font"], string> = {
  times: '"Times New Roman", Times, serif',
  century: '"Century Schoolbook", "Century Schoolbook L", Georgia, serif',
  courier: '"Courier New", Courier, monospace',
};
const DEFAULT_SPEC: Spec = {
  court: "IN THE SUPERIOR COURT OF THE STATE OF CALIFORNIA\nCOUNTY OF LOS ANGELES",
  plaintiff: "JANE DOE",
  defendant: "ACME CORPORATION",
  caseNo: "No. __________",
  title: "COMPLAINT FOR DAMAGES",
  font: "times",
  sizePt: 12,
  spacing: 2,
  align: "left",
  marginIn: 1,
  marginTopIn: 1.5, // many courts require a deeper top margin for the filing stamp
  lineNumbers: true,
  lineCount: 28,
  paragraphNumbers: true,
  pageNumbers: true,
};

function Builder() {
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [bodyHtml, setBodyHtml] = useState("");
  const [docxBusy, setDocxBusy] = useState(false);
  const set = <K extends keyof Spec>(k: K, v: Spec[K]) => setSpec((s) => ({ ...s, [k]: v }));

  // The portable, still-editable copy. Always exports the saved body (the editor
  // persists on input), so it works from either mode. docx is lazy-loaded.
  const downloadDocx = async () => {
    if (docxBusy) return;
    setDocxBusy(true);
    try {
      let saved = "";
      try {
        saved = localStorage.getItem(STORAGE_BODY) || "";
      } catch {
        /* ignore */
      }
      const body = saved && saved.trim() ? saved : DEFAULT_BODY_HTML;
      const { exportDocx } = await import("@/lib/docx-export");
      const name = (spec.title || "pleading").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
      await exportDocx(spec, body, `${name || "pleading"}.docx`);
    } catch {
      /* swallow — a failed export shouldn't break the page */
    } finally {
      setDocxBusy(false);
    }
  };

  // Entering preview paginates from the saved body (the editor persists to it on
  // input). Re-pagination happens only here, never on keystroke — so the caret in
  // edit mode is never disturbed.
  const enterPreview = () => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_BODY) || "";
    } catch {
      /* ignore */
    }
    setBodyHtml(saved && saved.trim() ? saved : DEFAULT_BODY_HTML);
    setMode("preview");
  };

  // Load saved spec once; guard saves until then so we never overwrite storage
  // with the defaults on first paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SPEC);
      if (raw) setSpec((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_SPEC, JSON.stringify(spec));
    } catch {
      /* ignore */
    }
  }, [spec, hydrated]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Print rules: hide everything but the page; set the physical page up.
          Paragraph numbering via a CSS counter so the numbers are automatic. */}
      <style>{`
        @page { size: Letter; margin: ${spec.marginIn}in; margin-top: ${spec.marginTopIn}in; }
        [data-doc-body] > p { margin: 0 0 var(--lh, 12pt); }
        [data-doc-body]:empty::before { content: "Type your complaint here…"; color: #999; }
        .doc-body-numbered { counter-reset: para; }
        .doc-body-numbered > p { counter-increment: para; position: relative; padding-left: 0.55in; text-indent: 0; }
        .doc-body-numbered > p::before {
          content: counter(para) ".";
          position: absolute;
          left: 0;
          width: 0.45in;
          text-align: left;
        }
        /* Paged.js preview sheets */
        .pagedjs-host .pagedjs_page { background: #fff; margin: 0 auto 1rem; box-shadow: 0 2px 16px rgba(0,0,0,0.4); }
        @media print {
          body * { visibility: hidden; }
          .doc-print-area, .doc-print-area * { visibility: visible; }
          /* full width, natural height so multi-page output flows across sheets */
          .doc-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; background: #fff; padding: 0; }
          .doc-print-area .doc-page { box-shadow: none; margin: 0; width: auto; min-height: 0; }
          .pagedjs-host .pagedjs_page { box-shadow: none; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        {/* ---- Controls ---- */}
        <aside className="no-print w-full shrink-0 lg:w-80">
          <div className="flex items-center gap-2 pb-1">
            <FileText className="h-5 w-5 text-ochre" />
            <h1 className="font-display text-lg font-semibold">Document Builder</h1>
          </div>
          <p className="pb-4 text-sm text-foreground/60">
            Set the format, fill the caption, write the body, export a PDF. Every option is right
            here — no Word, no buried tabs.
          </p>

          <div className="space-y-5 rounded-xl border border-border/60 bg-card p-4">
            <Group label="Caption">
              <Field label="Court">
                <textarea
                  value={spec.court}
                  onChange={(e) => set("court", e.target.value)}
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </Field>
              <Field label="Plaintiff">
                <input
                  value={spec.plaintiff}
                  onChange={(e) => set("plaintiff", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Defendant">
                <input
                  value={spec.defendant}
                  onChange={(e) => set("defendant", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Case number">
                <input
                  value={spec.caseNo}
                  onChange={(e) => set("caseNo", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Document title">
                <input
                  value={spec.title}
                  onChange={(e) => set("title", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </Group>

            <Group label="Type">
              <Field label="Font">
                <select
                  value={spec.font}
                  onChange={(e) => set("font", e.target.value as Spec["font"])}
                  className={inputCls}
                >
                  <option value="times">Times New Roman</option>
                  <option value="century">Century Schoolbook</option>
                  <option value="courier">Courier New</option>
                </select>
              </Field>
              <Field label="Size">
                <select
                  value={spec.sizePt}
                  onChange={(e) => set("sizePt", Number(e.target.value))}
                  className={inputCls}
                >
                  {[12, 13, 14].map((n) => (
                    <option key={n} value={n}>
                      {n} pt
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Line spacing">
                <select
                  value={spec.spacing}
                  onChange={(e) => set("spacing", Number(e.target.value))}
                  className={inputCls}
                >
                  <option value={1.15}>Single</option>
                  <option value={1.5}>1.5</option>
                  <option value={2}>Double</option>
                </select>
              </Field>
              <Field label="Alignment">
                <select
                  value={spec.align}
                  onChange={(e) => set("align", e.target.value as Spec["align"])}
                  className={inputCls}
                >
                  <option value="left">Left</option>
                  <option value="justify">Justified</option>
                </select>
              </Field>
            </Group>

            <Group label="Layout">
              <Field label="Side & bottom margins">
                <select
                  value={spec.marginIn}
                  onChange={(e) => set("marginIn", Number(e.target.value))}
                  className={inputCls}
                >
                  {[0.5, 1, 1.5].map((n) => (
                    <option key={n} value={n}>
                      {n}&quot;
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Top margin (clerk stamp)">
                <select
                  value={spec.marginTopIn}
                  onChange={(e) => set("marginTopIn", Number(e.target.value))}
                  className={inputCls}
                >
                  {[1, 1.5, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}&quot;
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label="Pleading line numbers"
                checked={spec.lineNumbers}
                onChange={(v) => set("lineNumbers", v)}
              />
              {spec.lineNumbers && (
                <Field label="Lines per page">
                  <select
                    value={spec.lineCount}
                    onChange={(e) => set("lineCount", Number(e.target.value))}
                    className={inputCls}
                  >
                    {[25, 26, 28].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Toggle
                label="Number paragraphs"
                checked={spec.paragraphNumbers}
                onChange={(v) => set("paragraphNumbers", v)}
              />
              <Toggle
                label="Page numbers"
                checked={spec.pageNumbers}
                onChange={(v) => set("pageNumbers", v)}
              />
            </Group>

            {mode === "edit" ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={enterPreview}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-ochre px-4 py-2.5 font-display text-sm font-semibold text-[#1a1206]"
                >
                  <Eye className="h-4 w-4" />
                  Paginate &amp; preview
                </button>
                <button
                  onClick={downloadDocx}
                  disabled={docxBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-sm text-foreground/80 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {docxBusy ? "Preparing…" : "Download .docx"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-ochre px-4 py-2.5 font-display text-sm font-semibold text-[#1a1206]"
                >
                  <Printer className="h-4 w-4" />
                  Export PDF
                </button>
                <button
                  onClick={downloadDocx}
                  disabled={docxBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-sm text-foreground/80 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {docxBusy ? "Preparing…" : "Download .docx"}
                </button>
                <button
                  onClick={() => setMode("edit")}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-4 py-2.5 text-sm text-foreground/80"
                >
                  <Pencil className="h-4 w-4" />
                  Back to editing
                </button>
              </div>
            )}
            <p className="text-center text-xs text-foreground/45">
              {mode === "edit"
                ? "Preview lays the document into real pages."
                : "Export opens your print dialog → choose “Save as PDF”."}
            </p>
          </div>
        </aside>

        {/* ---- Page surface: editable single page, or paginated preview ---- */}
        <main className="doc-print-area flex-1 overflow-x-auto rounded-xl bg-[#525659] p-4 sm:p-8">
          {mode === "edit" ? (
            <DocPage spec={spec} />
          ) : (
            <PagedPreview spec={spec} bodyHtml={bodyHtml} />
          )}
        </main>
      </div>
    </div>
  );
}

/* The page itself: a real 8.5×11 letter sheet with the spec applied. Single page
   for now; true multi-page flow + per-page line-number reset + "Page N of M"
   come with the Paged.js pass. */
function DocPage({ spec }: { spec: Spec }) {
  const lineHeight = spec.sizePt * spec.spacing; // px ≈ pt at 96dpi preview
  const lineNums = Array.from({ length: spec.lineCount }, (_, i) => i + 1);

  return (
    <div
      className="doc-page mx-auto bg-white text-black shadow-[0_2px_16px_rgba(0,0,0,0.4)]"
      style={{
        width: "8.5in",
        minHeight: "11in",
        paddingTop: `${spec.marginTopIn}in`,
        paddingBottom: `${spec.marginIn}in`,
        paddingLeft: `${spec.marginIn + (spec.lineNumbers ? 0.4 : 0)}in`,
        paddingRight: `${spec.marginIn}in`,
        fontFamily: FONT_STACK[spec.font],
        fontSize: `${spec.sizePt}pt`,
        lineHeight: `${lineHeight}pt`,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Pleading line-number gutter + vertical rule */}
      {spec.lineNumbers && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: `${spec.marginTopIn}in`,
            left: `${spec.marginIn - 0.05}in`,
            bottom: `${spec.marginIn}in`,
            width: "0.35in",
            borderRight: "1.5px solid #444",
            textAlign: "right",
            paddingRight: "0.1in",
            fontSize: `${spec.sizePt}pt`,
            lineHeight: `${lineHeight}pt`,
            color: "#333",
          }}
        >
          {lineNums.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
      )}

      {/* Caption block — court / parties / case no / title */}
      <header style={{ textAlign: "center", whiteSpace: "pre-line", fontWeight: 700 }}>
        {spec.court}
      </header>

      <table style={{ width: "100%", marginTop: `${lineHeight}pt`, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td
              style={{
                width: "55%",
                verticalAlign: "top",
                borderRight: "1px solid #000",
                paddingRight: "0.3in",
              }}
            >
              <div>{spec.plaintiff || "PLAINTIFF"},</div>
              <div style={{ paddingLeft: "1.5in" }}>Plaintiff,</div>
              <div style={{ marginTop: `${lineHeight}pt` }}>v.</div>
              <div style={{ marginTop: `${lineHeight}pt` }}>{spec.defendant || "DEFENDANT"},</div>
              <div style={{ paddingLeft: "1.5in" }}>Defendant.</div>
            </td>
            <td style={{ verticalAlign: "top", paddingLeft: "0.3in" }}>
              <div>{spec.caseNo}</div>
              <div
                style={{
                  marginTop: `${lineHeight}pt`,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {spec.title}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Body — the user types here; paragraphs auto-number if enabled */}
      <DocBody spec={spec} lineHeight={lineHeight} />

      {spec.pageNumbers && (
        <div
          style={{
            position: "absolute",
            bottom: `${spec.marginIn / 2}in`,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: `${spec.sizePt - 1}pt`,
          }}
        >
          Page 1
        </div>
      )}
    </div>
  );
}

function DocBody({ spec, lineHeight }: { spec: Spec; lineHeight: number }) {
  // Uncontrolled on purpose: React must not re-render the editable children (it
  // would reset the caret). We populate innerHTML once from storage, then persist
  // on input. Paragraph spacing rides on a CSS var so it tracks the spec live
  // without React touching the DOM the user is typing in.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_BODY);
    } catch {
      /* ignore */
    }
    el.innerHTML = saved && saved.trim() ? saved : DEFAULT_BODY_HTML;
  }, []);
  const onInput = () => {
    try {
      localStorage.setItem(STORAGE_BODY, ref.current?.innerHTML ?? "");
    } catch {
      /* ignore */
    }
  };
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      data-doc-body
      className={spec.paragraphNumbers ? "doc-body-numbered" : ""}
      style={{
        // Two blank lines below the caption keeps the body on the line-number grid.
        marginTop: `${lineHeight * 2}pt`,
        textAlign: spec.align,
        outline: "none",
        minHeight: "3in",
        counterReset: "para",
        ["--lh" as never]: `${lineHeight}pt`,
      }}
    />
  );
}

/* =============================================================================
   § Paginated preview (Paged.js). Flows the document into real letter pages,
   adds "Page N of M" via an @page margin box, and hangs a numbered pleading
   gutter off every page via a Paged.js handler. Runs only in preview mode, so
   it never re-paginates while the user types.
   ========================================================================== */
function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

function buildContentHtml(spec: Spec, bodyHtml: string) {
  const court = escapeHtml(spec.court);
  return (
    `<div class="doc-content">` +
    `<header class="doc-caption">${court}</header>` +
    `<table class="doc-parties"><tbody><tr>` +
    `<td class="l"><div>${escapeHtml(spec.plaintiff) || "PLAINTIFF"},</div>` +
    `<div class="indent">Plaintiff,</div><div class="gap">v.</div>` +
    `<div class="gap">${escapeHtml(spec.defendant) || "DEFENDANT"},</div>` +
    `<div class="indent">Defendant.</div></td>` +
    `<td class="r"><div>${escapeHtml(spec.caseNo)}</div>` +
    `<div class="doc-title">${escapeHtml(spec.title)}</div></td>` +
    `</tr></tbody></table>` +
    `<div class="doc-body ${spec.paragraphNumbers ? "numbered" : ""}">${bodyHtml}</div>` +
    `</div>`
  );
}

function buildDocCss(spec: Spec) {
  const lh = spec.sizePt * spec.spacing; // pt
  const stack = FONT_STACK[spec.font];
  const pageNum = spec.pageNumbers
    ? `@bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: ${stack}; font-size: ${spec.sizePt - 1}pt; }`
    : "";
  return `
    @page {
      size: Letter;
      margin: ${spec.marginIn}in;
      margin-top: ${spec.marginTopIn}in;
      margin-left: ${spec.marginIn + (spec.lineNumbers ? 0.4 : 0)}in;
      ${pageNum}
    }
    .doc-content { font-family: ${stack}; font-size: ${spec.sizePt}pt; line-height: ${lh}pt; color: #000; }
    .doc-caption { text-align: center; white-space: pre-line; font-weight: 700; }
    .doc-parties { width: 100%; border-collapse: collapse; margin-top: ${lh}pt; }
    .doc-parties td.l { width: 55%; vertical-align: top; border-right: 1px solid #000; padding-right: .3in; }
    .doc-parties td.r { vertical-align: top; padding-left: .3in; }
    .doc-parties .indent { padding-left: 1.5in; }
    .doc-parties .gap { margin-top: ${lh}pt; }
    .doc-title { font-weight: 700; text-transform: uppercase; margin-top: ${lh}pt; }
    .doc-body { margin-top: ${lh * 2}pt; text-align: ${spec.align}; }
    .doc-body > p { margin: 0 0 ${lh}pt; }
    .doc-body.numbered { counter-reset: para; }
    .doc-body.numbered > p { counter-increment: para; position: relative; padding-left: .55in; }
    .doc-body.numbered > p::before { content: counter(para) "."; position: absolute; left: 0; width: .45in; }
    /* per-page pleading gutter, appended by the handler */
    .pagedjs_page_content { position: relative; }
    .pleading-gutter {
      position: absolute; top: 0; bottom: 0; left: -.4in; width: .3in;
      border-right: 1.5px solid #444; text-align: right; padding-right: .08in;
      font-family: ${stack}; font-size: ${spec.sizePt}pt; line-height: ${lh}pt; color: #333;
    }
  `;
}

// Module-level config the handler reads at layout time (set before each preview).
const GUTTER = { on: true, count: 28 };
let pagedReady: Promise<typeof import("pagedjs")> | null = null;
function ensurePaged() {
  if (!pagedReady) {
    pagedReady = import("pagedjs").then((mod) => {
      class PleadingGutter extends mod.Handler {
        afterPageLayout(pageElement: HTMLElement) {
          if (!GUTTER.on) return;
          const area = pageElement.querySelector(".pagedjs_page_content");
          if (!area) return;
          const g = document.createElement("div");
          g.className = "pleading-gutter";
          for (let i = 1; i <= GUTTER.count; i++) {
            const d = document.createElement("div");
            d.textContent = String(i);
            g.appendChild(d);
          }
          area.appendChild(g);
        }
      }
      mod.registerHandlers(PleadingGutter);
      return mod;
    });
  }
  return pagedReady;
}

function PagedPreview({ spec, bodyHtml }: { spec: Spec; bodyHtml: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages(null);
    setErr(null);
    (async () => {
      try {
        const mod = await ensurePaged();
        const host = hostRef.current;
        if (!host || cancelled) return;
        host.innerHTML = "";
        GUTTER.on = spec.lineNumbers;
        GUTTER.count = spec.lineCount;
        const content = document.createElement("div");
        content.innerHTML = buildContentHtml(spec, bodyHtml);
        const previewer = new mod.Previewer();
        const flow = await previewer.preview(content, [{ "doc.css": buildDocCss(spec) }], host);
        if (!cancelled) setPages(flow.total);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, bodyHtml]);

  return (
    <div>
      <div className="no-print pb-3 text-center text-xs text-white/70">
        {err
          ? `Pagination error: ${err}`
          : pages == null
            ? "Paginating…"
            : `${pages} page${pages === 1 ? "" : "s"}`}
      </div>
      <div ref={hostRef} className="pagedjs-host" />
    </div>
  );
}

/* ---- small styled control helpers (brand tokens, native elements) ---- */
const inputCls =
  "w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-ochre focus:outline-none";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="pb-2 font-display text-[11px] uppercase tracking-[0.16em] text-foreground/45">
        {label}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground/70">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
      <span className="text-xs font-medium text-foreground/70">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-ochre" : "bg-border"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}
