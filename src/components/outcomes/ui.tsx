/**
 * Shared presentation for the Court Outcomes pages.
 *
 * Outcomes are DESCRIPTIVE STATISTICS drawn from the FJC Integrated Database
 * (public domain) — what happened across millions of closed federal civil
 * cases. They are never a prediction about any one case (the UPL line). The
 * copy here keeps that frame explicit.
 */
import { Link } from "@tanstack/react-router";

// outcome enum -> label + a stable data-viz color (fixed hex so the bars read
// the same in light/dark; the warm palette echoes the site's ochre/oxblood).
export const OUTCOME_META: Record<string, { label: string; hex: string }> = {
  plaintiff_win: { label: "Plaintiff win", hex: "#3f7d54" },
  defendant_win: { label: "Defendant win", hex: "#8b2e1f" },
  mixed:         { label: "Mixed", hex: "#e8b84a" },
  settled:       { label: "Settled", hex: "#5b7891" },
  dismissed:     { label: "Dismissed", hex: "#9a9385" },
  remanded:      { label: "Remanded", hex: "#7c6f9a" },
  transferred:   { label: "Transferred", hex: "#b0a48f" },
  affirmed:      { label: "Affirmed", hex: "#3f7d54" },
  reversed:      { label: "Reversed", hex: "#8b2e1f" },
  vacated:       { label: "Vacated", hex: "#a85522" },
  modified:      { label: "Modified", hex: "#c2873f" },
  denied:        { label: "Denied", hex: "#6b6258" },
  granted:       { label: "Granted", hex: "#4f7a6a" },
  decided_other: { label: "Decided — other", hex: "#8a8275" },
  other:         { label: "Other", hex: "#b5ad9e" },
};

export function outcomeLabel(o: string): string {
  return OUTCOME_META[o]?.label ?? o;
}
export function outcomeHex(o: string): string {
  return OUTCOME_META[o]?.hex ?? "#b5ad9e";
}

// Family slug -> display name + one-line blurb (drives the hub + landing copy).
export const FAMILY_META: Record<string, { name: string; blurb: string }> = {
  "civil-rights":            { name: "Civil Rights", blurb: "Discrimination, voting, ADA, §1983, and constitutional claims." },
  "prisoner-petitions":      { name: "Prisoner Petitions", blurb: "Habeas corpus, civil-rights, and prison-condition suits." },
  "torts":                   { name: "Torts", blurb: "Personal injury, product liability, and property-damage claims." },
  "contract":                { name: "Contract", blurb: "Insurance, debt collection, and commercial contract disputes." },
  "real-property":           { name: "Real Property", blurb: "Foreclosure, condemnation, and land disputes." },
  "immigration":             { name: "Immigration", blurb: "Deportation, naturalization, and detainee habeas." },
  "forfeiture-penalty":      { name: "Forfeiture & Penalty", blurb: "Asset seizure, drug forfeiture, and regulatory penalties." },
  "labor-employment":        { name: "Labor & Employment", blurb: "FLSA wage claims, ERISA benefits, FMLA, and union disputes." },
  "intellectual-property":   { name: "Intellectual Property", blurb: "Patent, copyright, trademark, and trade-secret suits." },
  "social-security":         { name: "Social Security", blurb: "Disability (DIB/SSI) and Medicare benefit appeals." },
  "tax":                     { name: "Tax", blurb: "Federal tax suits and IRS third-party actions." },
  "bankruptcy":              { name: "Bankruptcy", blurb: "Bankruptcy appeals and reference withdrawals." },
  "financial-securities":    { name: "Financial & Securities", blurb: "Securities, banking, RICO, and consumer-credit suits." },
  "other-federal-statutes":  { name: "Other Federal Statutes", blurb: "Antitrust, environmental, FOIA, and other statutory actions." },
};

export function familySlugFromName(name: string | null): string | null {
  if (!name) return null;
  const hit = Object.entries(FAMILY_META).find(([, v]) => v.name === name);
  return hit ? hit[0] : null;
}

export const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US");

export const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0;

export type OutcomeRow = { outcome: string; n: number };

/** Horizontal segmented distribution bar + legend. */
export function OutcomeBar({ rows }: { rows: OutcomeRow[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (!total) return null;
  const sorted = [...rows].sort((a, b) => b.n - a.n);
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-lg border border-border/60">
        {sorted.map((r) => {
          const w = (100 * r.n) / total;
          if (w < 0.4) return null;
          return (
            <div
              key={r.outcome}
              style={{ width: `${w}%`, backgroundColor: outcomeHex(r.outcome) }}
              title={`${outcomeLabel(r.outcome)} — ${fmt(r.n)} (${pct(r.n, total)}%)`}
            />
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {sorted.map((r) => (
          <li key={r.outcome} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: outcomeHex(r.outcome) }} />
            <span className="min-w-0 flex-1 truncate text-foreground/80">{outcomeLabel(r.outcome)}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{pct(r.n, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single big headline number. */
export function BigStat({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card px-5 py-4">
      <div className={`font-display text-3xl font-semibold tabular-nums md:text-4xl ${accent ? "text-terracotta" : ""}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-foreground/80">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Breadcrumbs. */
export function Crumbs({ items }: { items: { to: string; label: string }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={it.to} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-foreground/30">/</span>}
          {i === items.length - 1 ? (
            <span className="text-foreground/70">{it.label}</span>
          ) : (
            <Link to={it.to as never} className="hover:text-foreground hover:underline">{it.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/** State-appellate methodology + UPL footer — carries the appellate asterisk. */
export function StateDataNote() {
  return (
    <p className="mt-10 border-t border-border/50 pt-4 text-[12px] leading-relaxed text-muted-foreground">
      Source: <span className="text-foreground/70">CourtListener opinion clusters</span>, dispositions classified into
      outcomes (rules-based, ~95% coverage). This is <span className="text-foreground/70">appellate data</span> — it
      describes whether lower-court rulings were affirmed or reversed, not who wins at trial. Coverage varies by state,
      and a single court's practice shifts over time. Figures are descriptive statistics about the historical record —
      not a prediction about any specific appeal. Check your local rules. Not legal advice.
    </p>
  );
}

/** Methodology + UPL footer — stamped on every outcomes page. */
export function DataNote() {
  return (
    <p className="mt-10 border-t border-border/50 pt-4 text-[12px] leading-relaxed text-muted-foreground">
      Source: <span className="text-foreground/70">FJC Integrated Database</span> (public domain), via CourtListener —
      federal civil cases filed and terminated, 1988–present. Figures are{" "}
      <span className="text-foreground/70">descriptive statistics</span> about how cases of a given type have closed in a
      given court. They describe the historical record — not a prediction or assessment of any specific case. Not legal advice.
    </p>
  );
}
