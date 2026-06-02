/**
 * Source taxonomy for the corpus navigator.
 *
 * Add new sources by appending a row. The CorpusTree picks groups up
 * automatically — no UI changes needed.
 */

import {
  Landmark,
  MapPin,
  Scale,
  Building2,
  BookOpen,
  FileText,
  Newspaper,
  Vote,
  Crown,
  type LucideIcon,
} from "lucide-react";

export type GroupKey = "federal" | "state" | "caselaw" | "agency" | "other";

export type CorpusGroup = {
  key: GroupKey;
  label: string;
  icon: LucideIcon;
  blurb: string;
};

export const CORPUS_GROUPS: Record<GroupKey, CorpusGroup> = {
  federal: {
    key: "federal",
    label: "Federal",
    icon: Landmark,
    blurb: "Constitution, statutes, regulations, model codes, agency manuals.",
  },
  state: {
    key: "state",
    label: "States",
    icon: MapPin,
    blurb: "State constitutions, statutes, and regulations — by jurisdiction.",
  },
  caselaw: {
    key: "caselaw",
    label: "Caselaw",
    icon: Scale,
    blurb: "Supreme Court and federal circuit opinions, wired to the sections they interpret.",
  },
  agency: {
    key: "agency",
    label: "Agency",
    icon: Building2,
    blurb: "Agency manuals and internal operating rules beyond the CFR.",
  },
  other: {
    key: "other",
    label: "Other",
    icon: BookOpen,
    blurb: "Bills, the Federal Register, treaties, and other primary sources.",
  },
};

export const GROUP_ORDER: GroupKey[] = ["federal", "state", "caselaw", "agency", "other"];

/**
 * Per-source metadata. `group` is the only field the tree strictly needs;
 * the rest (`short`, `accent`) keeps callsites consistent across pages.
 */
export type SourceMeta = {
  code: string;
  short: string;
  group: GroupKey;
  accent: string;
  icon?: LucideIcon;
  tagline?: string;
};

export const SOURCE_META: Record<string, SourceMeta> = {
  const: {
    code: "const",
    short: "Const.",
    group: "federal",
    accent: "#b22234",
    icon: Landmark,
    tagline: "The founding charter — articles & amendments.",
  },
  usc: {
    code: "usc",
    short: "U.S.C.",
    group: "federal",
    accent: "#0a1f44",
    icon: FileText,
    tagline: "Federal statutory law, organized by title.",
  },
  cfr: {
    code: "cfr",
    short: "C.F.R.",
    group: "federal",
    accent: "#1a4a2e",
    icon: FileText,
    tagline: "Federal agency regulations — the rulebook that implements statutes.",
  },
  ucc: {
    code: "ucc",
    short: "U.C.C.",
    group: "federal",
    accent: "#c9a84c",
    icon: BookOpen,
    tagline: "Model commercial law adopted by every state.",
  },
  tfm: {
    code: "tfm",
    short: "TFM",
    group: "agency",
    accent: "#5b3a8a",
    icon: Building2,
    tagline: "Treasury rules for federal financial operations.",
  },
  irm: {
    code: "irm",
    short: "IRM",
    group: "agency",
    accent: "#c45a2c",
    icon: Building2,
    tagline: "How the IRS internally administers the tax code.",
  },
  register: {
    code: "register",
    short: "Fed. Reg.",
    group: "other",
    accent: "#c45a2c",
    icon: Newspaper,
    tagline: "Daily journal of federal agency rules, proposed rules, and notices.",
  },
  bill: {
    code: "bill",
    short: "Bills",
    group: "other",
    accent: "#5b3a8a",
    icon: Vote,
    tagline: "Every bill and resolution introduced in Congress, with each text version.",
  },
  "public-papers-president": {
    code: "public-papers-president",
    short: "Pres. Papers",
    group: "other",
    accent: "#7a3b3b",
    icon: Crown,
    tagline: "Official addresses, remarks, and statements of the President.",
  },
  "statutes-at-large": {
    code: "statutes-at-large",
    short: "Stat.",
    group: "federal",
    accent: "#6b4226",
    icon: BookOpen,
    tagline: "Every law Congress has passed, in chronological order since 1789.",
  },
  "statute-compilations": {
    code: "statute-compilations",
    short: "Stat. Comp.",
    group: "federal",
    accent: "#3a5a40",
    icon: FileText,
    tagline: "Office of Law Revision Counsel compilations of selected statutes.",
  },
  "public-private-law": {
    code: "public-private-law",
    short: "Pub. L.",
    group: "other",
    accent: "#4a5d8a",
    icon: FileText,
    tagline: "Public and private laws as enacted, before codification.",
  },
};

/**
 * Full display names, keyed by the real `source_code` values in
 * document_sections. Single source of truth — imported by listSources, the
 * source browser, and the codebook landing so the names never drift apart.
 */
export const SOURCE_NAMES: Record<string, string> = {
  const: "U.S. Constitution",
  usc: "United States Code",
  cfr: "Code of Federal Regulations",
  ucc: "Uniform Commercial Code",
  tfm: "Treasury Financial Manual",
  irm: "Internal Revenue Manual",
  bill: "Congressional Bills",
  register: "Federal Register",
  "statutes-at-large": "Statutes at Large",
  "statute-compilations": "Statute Compilations",
  "public-private-law": "Public & Private Laws",
  "public-papers-president": "Public Papers of the Presidents",
};

/**
 * The 50 states (plus DC), keyed by the lowercased `source_code` used when
 * state_sections is projected into document_sections (see
 * scripts/project_states_to_documents.py). One source per state; this single
 * map drives both the display name and the `state`-group metadata so the
 * CorpusTree, the /states landing, and search all label them consistently.
 */
export const STATE_NAMES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
};

export const STATE_CODES = Object.keys(STATE_NAMES);

export function sourceName(code: string): string {
  return SOURCE_NAMES[code] ?? STATE_NAMES[code] ?? code.toUpperCase();
}

export function sourceMeta(code: string): SourceMeta {
  if (SOURCE_META[code]) return SOURCE_META[code];
  if (STATE_NAMES[code]) {
    return {
      code,
      short: STATE_NAMES[code],
      group: "state",
      accent: "#4a6741",
      icon: MapPin,
      tagline: `${STATE_NAMES[code]} statutes and constitution.`,
    };
  }
  return (
    {
      code,
      short: code.toUpperCase(),
      group: "other",
      accent: "var(--terracotta)",
    }
  );
}
