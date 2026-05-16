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
};

export function sourceMeta(code: string): SourceMeta {
  return (
    SOURCE_META[code] ?? {
      code,
      short: code.toUpperCase(),
      group: "other",
      accent: "var(--terracotta)",
    }
  );
}
