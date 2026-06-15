import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Landmark, ArrowUp } from "lucide-react";
import { getBillHistory, type BillHistoryRow } from "@/lib/documents.functions";

// Friendly labels for the GPO bill version codes we surface most.
const STAGE_LABEL: Record<string, string> = {
  enr: "Enacted", es: "Engrossed (Senate)", eh: "Engrossed (House)",
  eas: "Engrossed amend. (Senate)", eah: "Engrossed amend. (House)",
  rs: "Reported (Senate)", rh: "Reported (House)",
  pcs: "On calendar", rfs: "Referred (Senate)", rfh: "Referred (House)",
  is: "Introduced (Senate)", ih: "Introduced (House)",
  ats: "Agreed to (Senate)", ath: "Agreed to (House)",
};

function billCite(r: BillHistoryRow): string {
  const t = (r.bill_type ?? "").toUpperCase().replace("RES", " Res.").replace("CON", "Con");
  return `${t} ${r.number ?? ""}${r.congress ? ` · ${r.congress}th Cong.` : ""}`.trim();
}

// The congressional bills that amended (or proposed to amend) this U.S. Code
// section — Congress's own words behind the codified text. Lazy-loaded under the
// section, mirroring RegisterHistory. Returns null when there's no bill history,
// so non-USC or untouched sections stay clean.
export function BillHistory({ identifier }: { identifier: string }) {
  const [rows, setRows] = useState<BillHistoryRow[] | null>(null);

  useEffect(() => {
    getBillHistory({ data: { identifier } })
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));
  }, [identifier]);

  if (!rows || rows.length === 0) return null;

  return (
    <details className="group mt-12 rounded-2xl border border-border/60 bg-card">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Landmark className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-display text-sm font-semibold text-foreground">Legislative history</span>
          <span className="citation-tag text-muted-foreground">
            {rows.length} congressional bill{rows.length === 1 ? "" : "s"} reached for this section · enacted first
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/40 px-5 pb-6 pt-5">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.bill_key}>
              <Link
                to="/code/$"
                params={{ _splat: r.latest_id.replace(/^\//, "") }}
                className="group/bill flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/50 px-3.5 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold leading-snug text-foreground group-hover/bill:text-accent">
                    {r.short_title || r.title || billCite(r)}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 citation-tag text-muted-foreground">
                    <span className="font-mono text-[12px]">{billCite(r)}</span>
                    <span className="text-foreground/20">·</span>
                    {r.enacted ? (
                      <span className="font-semibold text-accent">Enacted</span>
                    ) : (
                      <span>{STAGE_LABEL[r.latest_stage ?? ""] ?? "Pending"}</span>
                    )}
                  </div>
                </div>
                <ArrowUp className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-muted-foreground/40 group-hover/bill:text-accent/60" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 citation-tag text-muted-foreground/70">
          Bills that amended (or proposed to amend) this section — the enacted text and the attempts. The bill's findings and purpose are Congress's stated reasoning. Read the source.
        </p>
      </div>
    </details>
  );
}
