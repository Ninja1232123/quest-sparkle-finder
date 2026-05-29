import { notFound } from "@tanstack/react-router";
import {
  listDocumentsBySource,
  listSources,
  getSourceTOC,
  getRegisterYears,
  getRegisterDays,
  getBillCongresses,
  getBillList,
  listDocsBySortRange,
  FIREHOSE_SOURCES,
} from "@/lib/documents.functions";

// Coerce a search param to a non-empty string (accepts numbers — the parser may
// hand back a number for digit-y values like a congress without leading zeros).
export const str = (v: unknown) => {
  if (typeof v === "string") return v.length > 0 ? v : undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
};
// Numeric search param. Kept as a NUMBER so the URL round-trips clean
// (`?ry=2000`, not the quoted `?ry="2000"` TanStack emits for numeric strings).
export const num = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
};

// All keys optional so Links may pass any subset (or none) without TS demanding
// the full shape. `group` = section drill; `tg` = title-group drill (intermediate
// level between title list and section list); ry/rd = register; bc/bk/bq/bp = bill.
// ry/rd/bp are numbers (clean URLs); the loader stringifies ry/rd as needed.
export type SourceSearch = {
  group?: string;
  tg?: string;
  ry?: number;
  rd?: number;
  bc?: string;
  bk?: string;
  bq?: string;
  bp?: number;
};

// Shared validator so every source route parses search params identically.
export function validateSourceSearch(search: Record<string, unknown>): SourceSearch {
  return {
    group: str(search.group),
    tg: str(search.tg),
    ry: num(search.ry),
    rd: num(search.rd),
    bc: str(search.bc),
    bk: str(search.bk),
    bq: str(search.bq),
    bp: num(search.bp),
  };
}

// Leaf sort_key range for a firehose drill-down, half-open [lo, hi).
// sort_key uses the DB's *locale* collation, where punctuation does NOT compare
// as ASCII — so the bounds must differ from the data only in DIGITS, never in a
// punctuation char. Hence "next day" / "next bill number" rather than appending
// a separator like ':' or '/'.
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
// 'YYYYMMDD' -> the next calendar day as 'YYYYMMDD' (handles month/year rollover).
function nextDay8(d: string): string {
  const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1));
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}
// 'CONG.TT.NNNNNN' -> 'CONG.TT.<NNNNNN+1>' (same width), an exclusive upper bound
// for one bill's sections that differs only in the number field's digits.
function nextBillKey(bk: string): string {
  const parts = bk.split(".");
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = String(Number(last) + 1).padStart(last.length, "0");
  return parts.join(".");
}
export function leafRange(source: string, key: string): { lo: string; hi: string } {
  if (source === "register") return { lo: key, hi: nextDay8(key) };
  return { lo: key + ".00000", hi: nextBillKey(key) };
}

async function loadFirehose(source: string, deps: SourceSearch) {
  if (source === "register") {
    // ry/rd arrive as numbers; stringify for the date keys. Validate the shape
    // here so a malformed param falls back to a valid view instead of throwing
    // (the server fns' zod validators would 500 on bad input otherwise).
    const rd = deps.rd != null ? String(deps.rd) : undefined;
    const ry = deps.ry != null ? String(deps.ry) : undefined;
    if (rd && /^\d{8}$/.test(rd)) {
      const { lo, hi } = leafRange(source, rd);
      const { documents } = await listDocsBySortRange({ data: { source, lo, hi, limit: 2000 } });
      return { view: "register-docs" as const, rd, documents };
    }
    if (ry && /^\d{4}$/.test(ry)) {
      const { days } = await getRegisterDays({ data: { year: ry } });
      return { view: "register-days" as const, ry, days };
    }
    const { years } = await getRegisterYears();
    return { view: "register-years" as const, years };
  }
  // bill
  if (deps.bk && /^\d+\.\d+\.\d+$/.test(deps.bk)) {
    const { lo, hi } = leafRange(source, deps.bk);
    const { documents } = await listDocsBySortRange({ data: { source, lo, hi, limit: 2000 } });
    return { view: "bill-docs" as const, bk: deps.bk, documents };
  }
  if (deps.bc && /^\d{1,4}$/.test(deps.bc)) {
    const limit = 60;
    const page = deps.bp ?? 0;
    const { bills, hasMore } = await getBillList({
      data: { congress: deps.bc, q: deps.bq, limit, offset: page * limit },
    });
    return { view: "bill-list" as const, bc: deps.bc, bq: deps.bq, bp: page, bills, hasMore };
  }
  const { congresses } = await getBillCongresses();
  return { view: "bill-congresses" as const, congresses };
}

// Shared loader for every source-browser route (the flat slugs AND the generic
// /code/source/$source). Firehoses (bill, register) drill by date/Congress;
// everything else renders the parent_label table of contents.
export async function loadSourceRoute({ source, deps }: { source: string; deps: SourceSearch }) {
  const sourcesPromise = listSources();

  if (FIREHOSE_SOURCES.has(source)) {
    const fh = await loadFirehose(source, deps);
    const { sources } = await sourcesPromise;
    return { kind: "firehose" as const, source, sources, ...fh };
  }

  const tocPromise = getSourceTOC({ data: { source } });
  const docsPromise = deps.group
    ? listDocumentsBySource({ data: { source, parent_label: deps.group, limit: 5000 } })
    : Promise.resolve({ documents: [], error: null as string | null });
  const [tocRes, sourcesRes, docsRes] = await Promise.all([tocPromise, sourcesPromise, docsPromise]);
  if (tocRes.error) throw new Error(tocRes.error);
  if (tocRes.toc.length === 0) throw notFound();
  return {
    kind: "toc" as const,
    toc: tocRes.toc,
    documents: docsRes.documents,
    sources: sourcesRes.sources,
    source,
    group: deps.group,
    tg: deps.tg,
  };
}

export type SourceRouteData = Awaited<ReturnType<typeof loadSourceRoute>>;
export type TocData = Extract<SourceRouteData, { kind: "toc" }>;
export type FirehoseData = Extract<SourceRouteData, { kind: "firehose" }>;
