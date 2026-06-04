import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { sourceMeta, sourceName } from "@/lib/source-groups";

/**
 * The section citation graph — a live ego-network drawn beneath the citation
 * text in the reader. The current section sits at the center; what it cites
 * fans out to the right, what cites it sits to the left.
 *
 * Two honesty rules drive the design:
 *  - The "cited by" side is grouped BY SOURCE with exact counts. A section
 *    cited 60,000× by the Federal Register isn't 60,000 important relationships
 *    — it's breadth of cross-reference from one corpus. Showing the count per
 *    source makes that legible instead of implying 60,000 peers.
 *  - Outbound case citations (SCOTUS, F. App'x, F. Supp.) resolve to no page in
 *    our corpus, but we still draw them as labeled nodes with their reporter
 *    cite. They're real citations; a reader can look the case up themselves.
 */

export type GraphTrace = {
  key: string;
  title: string; // heading, or the reporter cite for case law
  sub: string; // section label / identifier / cite detail
  source: string; // source_code for resolved internal targets; "" for external
  href: string | null; // internal /code link, or null for external/case cites
  kind: string; // target_type (usc, cfr, scotus, fed_app, …)
};

export type GraphCitedBy = { source: string; n: number };

type Props = {
  centerLabel: string;
  centerSub: string;
  centerSource: string;
  traces: GraphTrace[];
  citedBy: GraphCitedBy[];
  citedByTotal: number;
  tracesTotal: number;
};

// Short badge + display name for outbound case-law / instrument cites that have
// no source_code (they don't live in our corpus).
const KIND_LABEL: Record<string, { short: string; name: string }> = {
  scotus: { short: "SCOTUS", name: "U.S. Supreme Court" },
  sct: { short: "S. Ct.", name: "Supreme Court Reporter" },
  fed_app: { short: "F. App'x", name: "Federal Appendix" },
  fed_supp: { short: "F. Supp.", name: "Federal Supplement" },
  led: { short: "L. Ed.", name: "Lawyers' Edition" },
  eo: { short: "Exec. Ord.", name: "Executive Order" },
  pub_l: { short: "Pub. L.", name: "Public Law" },
  pl: { short: "Pub. L.", name: "Public Law" },
  stat: { short: "Stat.", name: "Statutes at Large" },
  act: { short: "Act", name: "Named Act" },
  td: { short: "Treas. Dec.", name: "Treasury Decision" },
  rev_rul: { short: "Rev. Rul.", name: "Revenue Ruling" },
  rev_proc: { short: "Rev. Proc.", name: "Revenue Procedure" },
  treas_reg: { short: "Treas. Reg.", name: "Treasury Regulation" },
  fed_reg: { short: "Fed. Reg.", name: "Federal Register" },
  other: { short: "Cite", name: "External reference" },
};

const CASE_KINDS = new Set(["scotus", "sct", "fed_app", "fed_supp", "led"]);
const CASE_ACCENT = "#6b3a2a"; // oxblood — distinguishes off-corpus case law
const EXT_ACCENT = "#8a8275"; // muted clay — other off-corpus instruments

function nodeStyle(t: GraphTrace): { accent: string; short: string } {
  if (t.source) {
    const m = sourceMeta(t.source);
    return { accent: m.accent, short: m.short };
  }
  const k = KIND_LABEL[t.kind] ?? KIND_LABEL.other;
  return { accent: CASE_KINDS.has(t.kind) ? CASE_ACCENT : EXT_ACCENT, short: k.short };
}

// Lay points on an arc. side=+1 → right fan, side=-1 → left fan.
function arc(n: number, side: 1 | -1, rx: number, ry: number) {
  return Array.from({ length: n }, (_, i) => {
    const span = Math.min(118, 26 + n * 13); // wider fan as count grows, capped
    const t = n === 1 ? 0.5 : i / (n - 1);
    const deg = -span / 2 + span * t;
    const rad = (deg * Math.PI) / 180;
    return { x: 50 + side * Math.cos(rad) * rx, y: 50 + Math.sin(rad) * ry };
  });
}

export function SectionCitationGraph({
  centerLabel,
  centerSub,
  centerSource,
  traces,
  citedBy,
  citedByTotal,
  tracesTotal,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const T = traces.slice(0, 12);
  const C = citedBy.slice(0, 7);
  const tPos = useMemo(() => arc(T.length, 1, 40, 40), [T.length]);
  const cPos = useMemo(() => arc(C.length, -1, 40, 42), [C.length]);

  const maxN = Math.max(1, ...C.map((c) => c.n));
  // node radius (in viewBox %) scaled by log of the citing volume
  const cRadius = (n: number) => 3.4 + 3.6 * (Math.log1p(n) / Math.log1p(maxN));

  const centerAccent = sourceMeta(centerSource).accent;
  const moreTraces = tracesTotal - T.length;

  if (T.length === 0 && C.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card paper-grain p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="font-display text-sm font-semibold">Citation graph</div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> cites
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: CASE_ACCENT }} /> case law
          </span>
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
        {/* edge layer — % coords, non-scaling strokes so lines stay crisp */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {T.map((t, i) => {
            const p = tPos[i];
            const hot = hover === t.key;
            const mx = (50 + p.x) / 2 + 5;
            return (
              <path
                key={`te-${t.key}`}
                d={`M 50 50 Q ${mx} ${p.y} ${p.x} ${p.y}`}
                fill="none"
                stroke={hot ? "var(--terracotta)" : nodeStyle(t).accent}
                strokeOpacity={hover && !hot ? 0.12 : hot ? 0.9 : 0.3}
                strokeWidth={hot ? 2 : 1.1}
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-200"
              />
            );
          })}
          {C.map((c, i) => {
            const p = cPos[i];
            const key = `cb-${c.source}`;
            const hot = hover === key;
            const mx = (50 + p.x) / 2 - 5;
            return (
              <path
                key={`ce-${c.source}`}
                d={`M 50 50 Q ${mx} ${p.y} ${p.x} ${p.y}`}
                fill="none"
                stroke={hot ? "var(--terracotta)" : sourceMeta(c.source).accent}
                strokeOpacity={hover && !hot ? 0.12 : hot ? 0.9 : 0.28}
                strokeWidth={hot ? 2 : 1.1}
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* center node */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "50%" }}
        >
          <div
            className="max-w-[10.5rem] rounded-xl border-2 bg-background px-3 py-2 text-center shadow-[var(--shadow-soft)]"
            style={{ borderColor: centerAccent }}
          >
            <div className="font-display text-[13px] font-semibold leading-tight">{centerLabel}</div>
            {centerSub ? (
              <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{centerSub}</div>
            ) : null}
          </div>
        </div>

        {/* cited-by nodes (left) — grouped by source, sized by honest count */}
        {C.map((c, i) => {
          const p = cPos[i];
          const key = `cb-${c.source}`;
          const m = sourceMeta(c.source);
          const d = cRadius(c.n) * 2;
          return (
            <div
              key={key}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-default"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onMouseEnter={() => setHover(key)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="flex flex-col items-center justify-center rounded-full border-2 bg-background font-mono font-semibold leading-none text-foreground/80 transition-transform group-hover:scale-105"
                style={{ width: `${d}vw`, maxWidth: 92, minWidth: 52, aspectRatio: "1", borderColor: m.accent }}
              >
                <span className="text-[10px]" style={{ color: m.accent }}>{m.short}</span>
                <span className="mt-0.5 text-[11px] tabular-nums">×{c.n.toLocaleString()}</span>
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-[10px] text-muted-foreground shadow-[var(--shadow-soft)] group-hover:block">
                {sourceName(c.source)} cites this {c.n.toLocaleString()}×
              </div>
            </div>
          );
        })}

        {/* trace nodes (right) — internal = link, case/external = labeled chip */}
        {T.map((t, i) => {
          const p = tPos[i];
          const ns = nodeStyle(t);
          const inner = (
            <div
              className="flex w-[5.2rem] flex-col items-center rounded-lg border bg-background px-1.5 py-1 text-center shadow-[var(--shadow-soft)] transition-transform group-hover:scale-105"
              style={{ borderColor: ns.accent }}
            >
              <span className="text-[9px] font-semibold" style={{ color: ns.accent }}>{ns.short}</span>
              <span className="mt-0.5 line-clamp-2 text-[9.5px] leading-tight text-foreground/80">
                {t.sub || t.title}
              </span>
              {!t.href ? <ExternalLink className="mt-0.5 h-2.5 w-2.5 text-muted-foreground/60" /> : null}
            </div>
          );
          return (
            <div
              key={t.key}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onMouseEnter={() => setHover(t.key)}
              onMouseLeave={() => setHover(null)}
            >
              {t.href ? (
                <Link to="/code/$" params={{ _splat: t.href.replace(/^\//, "") }} search={{ q: undefined }} title={t.title}>
                  {inner}
                </Link>
              ) : (
                <div title={`${t.title} — not in our corpus; look it up`}>{inner}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span>
          Cites <span className="font-medium text-foreground/75">{tracesTotal.toLocaleString()}</span>
          {moreTraces > 0 ? <span> · showing {T.length}</span> : null}
        </span>
        <span>
          Cited by <span className="font-medium text-foreground/75">{citedByTotal.toLocaleString()}</span> across{" "}
          {citedBy.length} source{citedBy.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
