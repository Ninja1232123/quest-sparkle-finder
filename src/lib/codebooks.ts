/**
 * Codebooks registry — the single source of truth for the top-level tab strip,
 * landing pages, and sitemap. Add a row to expand the index.
 *
 * `status: "live"`   — has data in the documents table, link to existing reader
 * `status: "soon"`   — placeholder tab, lands on a Coming Soon page
 * `status: "vision"` — long-horizon, kept in registry but NOT shown in nav yet
 *
 * `kind` controls the landing layout:
 *   - "small-toc"  → full table-of-contents on one page (Constitution, UCC)
 *   - "hierarchy" → Title/Chapter grid with section counts (USC, CFR)
 *   - "time"      → year picker + month density (Federal Register, Bills, etc.)
 *   - "cases"     → decade ribbon (SCOTUS)
 *   - "agency"    → card per agency (IRM, TFM, USGM)
 *
 * `sources` lists the `source_code` values in the documents table that belong
 * to this codebook. Most codebooks have one source; "agency" and "model"
 * group several.
 */

import {
  Landmark,
  Scale,
  BookOpen,
  FileText,
  Newspaper,
  Vote,
  ScrollText,
  Building2,
  Gavel,
  MapPin,
  Crown,
  Library,
  type LucideIcon,
} from "lucide-react";
import { STATE_CODES } from "./source-groups";

export type CodebookStatus = "live" | "soon" | "vision";
export type CodebookKind = "small-toc" | "hierarchy" | "time" | "cases" | "agency";

export type Codebook = {
  /** URL slug — `/{slug}` */
  slug: string;
  /** Short tab label (header) */
  tab: string;
  /** Full display name */
  name: string;
  /** One-sentence pitch shown on hover-panel + landing */
  tagline: string;
  status: CodebookStatus;
  kind: CodebookKind;
  /** Matching `source_code` values in the documents table (may be empty if not yet ingested). */
  sources: string[];
  /** Accent color for tab + landing chrome */
  accent: string;
  icon: LucideIcon;
  /** Quick-browse links surfaced in the header hover panel */
  quickLinks?: { label: string; href: string }[];
};

export const CODEBOOKS: Codebook[] = [
  {
    slug: "const",
    tab: "Const.",
    name: "U.S. Constitution",
    tagline: "The founding charter — articles and amendments.",
    status: "live",
    kind: "small-toc",
    sources: ["const"],
    accent: "#b22234",
    icon: Landmark,
  },
  {
    slug: "usc",
    tab: "U.S. Code",
    name: "United States Code",
    tagline: "Federal statutory law, organized by title.",
    status: "live",
    kind: "hierarchy",
    sources: ["usc"],
    accent: "#0a1f44",
    icon: FileText,
  },
  {
    slug: "cfr",
    tab: "CFR",
    name: "Code of Federal Regulations",
    tagline: "The rulebook that implements federal statutes.",
    status: "live",
    kind: "hierarchy",
    sources: ["cfr"],
    accent: "#1a4a2e",
    icon: FileText,
  },
  {
    slug: "register",
    tab: "Fed. Register",
    name: "Federal Register",
    tagline: "Daily rules, proposed rules, and notices from federal agencies.",
    status: "live",
    kind: "time",
    sources: ["register"],
    accent: "#c45a2c",
    icon: Newspaper,
  },
  {
    slug: "bills",
    tab: "Bills",
    name: "Congressional Bills",
    tagline: "Every bill and resolution introduced in Congress, with each text version.",
    status: "live",
    kind: "time",
    sources: ["bill"],
    accent: "#5b3a8a",
    icon: Vote,
  },
  {
    slug: "laws",
    tab: "Public Laws",
    name: "Public & Private Laws",
    tagline: "Bills enacted into law, by Congress and number.",
    status: "live",
    kind: "time",
    sources: ["public-private-law"],
    accent: "#0a1f44",
    icon: ScrollText,
  },
  {
    slug: "statutes",
    tab: "Statutes",
    name: "Statutes at Large & Compilations",
    tagline: "Bound annual volumes of every law passed by Congress.",
    status: "live",
    kind: "time",
    sources: ["statutes-at-large", "statute-compilations"],
    accent: "#6b3a2a",
    icon: BookOpen,
  },
  {
    slug: "presidential",
    tab: "Presidential",
    name: "Presidential Documents",
    tagline: "Public papers of the presidents — addresses, remarks, and statements.",
    status: "live",
    kind: "time",
    sources: ["public-papers-president"],
    accent: "#8b4513",
    icon: Crown,
  },
  {
    slug: "scotus",
    tab: "SCOTUS",
    name: "Supreme Court Decisions",
    tagline: "Opinions of the United States Supreme Court.",
    status: "soon",
    kind: "cases",
    sources: ["scotus", "flite"],
    accent: "#3d3d5c",
    icon: Gavel,
  },
  {
    slug: "agency",
    tab: "Agency",
    name: "Agency Manuals",
    tagline: "Internal operating rules and manuals beyond the CFR.",
    status: "live",
    kind: "agency",
    sources: ["irm", "tfm", "usgm"],
    accent: "#1a4a6e",
    icon: Building2,
  },
  {
    // UCC is the site's highest-traffic search term, so it gets its own clean,
    // citation-matching slug (/ucc) rather than living under a generic "model"
    // path. If more model/uniform acts land later, add sibling codebooks.
    slug: "ucc",
    tab: "UCC",
    name: "Uniform Commercial Code",
    tagline: "The model commercial-law statute behind sales, leases, and secured transactions.",
    status: "live",
    kind: "small-toc",
    sources: ["ucc"],
    accent: "#c9a84c",
    icon: Library,
  },
  {
    slug: "states",
    tab: "States",
    name: "State Law",
    tagline: "State constitutions, statutes, and regulations — by jurisdiction.",
    status: "live",
    kind: "small-toc",
    // One source per state (lowercased state code), projected into
    // document_sections from state_sections. DC has no data yet but is harmless
    // in the list — the landing only cards sources that actually return rows.
    sources: STATE_CODES,
    accent: "#4a6741",
    icon: MapPin,
  },
];

/* -----------------------------------------------------------
   Header nav grouping — a presentation layer ON TOP of CODEBOOKS.
   The Library strip shows 6 category dropdowns ("what you're
   looking for"), each fanning out to existing codebook/source
   routes. This does NOT change the codebook registry above, so
   landing pages, the sitemap, and source mapping are untouched.
   ----------------------------------------------------------- */
export type NavItem = {
  label: string;
  href: string;
  accent: string;
  status: CodebookStatus;
};
export type NavGroup = {
  key: string;
  /** Dropdown button text */
  label: string;
  /** Shown in the open panel header */
  tagline: string;
  /** Group accent (button dot + panel wash) */
  accent: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "constitution",
    label: "Constitution",
    tagline: "The founding charter — articles and amendments.",
    accent: "#b22234",
    items: [
      { label: "U.S. Constitution", href: "/const", accent: "#b22234", status: "live" },
    ],
  },
  {
    key: "federal",
    label: "Federal Code",
    tagline: "Federal statutes, regulations, and agency manuals.",
    accent: "#0a1f44",
    items: [
      { label: "United States Code", href: "/usc", accent: "#0a1f44", status: "live" },
      { label: "Code of Federal Regulations", href: "/cfr", accent: "#1a4a2e", status: "live" },
      { label: "Internal Revenue Manual", href: "/code/source/irm", accent: "#1a4a6e", status: "live" },
      { label: "Treasury Financial Manual", href: "/code/source/tfm", accent: "#1a4a6e", status: "live" },
      { label: "U.S. Government Manual", href: "/code/source/usgm", accent: "#1a4a6e", status: "live" },
    ],
  },
  {
    key: "state",
    label: "State Code",
    tagline: "State constitutions, statutes, and regulations — by jurisdiction.",
    accent: "#4a6741",
    items: [
      { label: "All 50 States", href: "/states", accent: "#4a6741", status: "live" },
      { label: "California", href: "/code/source/ca", accent: "#4a6741", status: "live" },
      { label: "Texas", href: "/code/source/tx", accent: "#4a6741", status: "live" },
      { label: "New York", href: "/code/source/ny", accent: "#4a6741", status: "live" },
      { label: "Florida", href: "/code/source/fl", accent: "#4a6741", status: "live" },
    ],
  },
  {
    key: "commercial",
    label: "Commercial Code",
    tagline: "The Uniform Commercial Code and the states' enactments of it.",
    accent: "#c9a84c",
    items: [
      { label: "Uniform Commercial Code", href: "/ucc", accent: "#c9a84c", status: "live" },
      { label: "State UCC enactments", href: "/states", accent: "#4a6741", status: "live" },
    ],
  },
  {
    key: "court",
    label: "Court Record",
    tagline: "Opinions, decisions, and outcome statistics of the courts.",
    accent: "#3d3d5c",
    items: [
      { label: "Court Outcomes", href: "/outcomes", accent: "#8b2e1f", status: "live" },
      { label: "Supreme Court Opinions", href: "/record", accent: "#3d3d5c", status: "live" },
    ],
  },
  {
    key: "publications",
    label: "Publications",
    tagline: "Daily federal documents — rules, bills, laws, and presidential papers.",
    accent: "#c45a2c",
    items: [
      { label: "Federal Register", href: "/register", accent: "#c45a2c", status: "live" },
      { label: "Congressional Bills", href: "/bills", accent: "#5b3a8a", status: "live" },
      { label: "Public & Private Laws", href: "/laws", accent: "#0a1f44", status: "live" },
      { label: "Statutes at Large", href: "/statutes", accent: "#6b3a2a", status: "live" },
      { label: "Presidential Documents", href: "/presidential", accent: "#8b4513", status: "live" },
    ],
  },
];

export function getCodebook(slug: string): Codebook | undefined {
  return CODEBOOKS.find((c) => c.slug === slug);
}

/** Map a `source_code` value back to the codebook that owns it. */
export function codebookForSource(source: string): Codebook | undefined {
  return CODEBOOKS.find((c) => c.sources.includes(source));
}

/**
 * The clean single-source slug path for a `source_code`, or null if it has none.
 * Only LIVE codebooks that own exactly one source qualify (usc, cfr, const,
 * register, bills→bill, laws→public-private-law, presidential→…, ucc).
 * Multi-source members (irm/tfm/usgm under "agency", statutes-* under
 * "statutes") return null and keep living at /code/source/$source.
 */
export function cleanPathForSource(code: string): string | null {
  const cb = CODEBOOKS.find(
    (c) => c.status === "live" && c.sources.length === 1 && c.sources[0] === code,
  );
  return cb ? `/${cb.slug}` : null;
}

/** Inverse of cleanPathForSource: given a pathname like "/usc", the source_code
 *  it browses (or null for non-codebook paths like /search). */
export function sourceForCleanPath(pathname: string): string | null {
  const seg = pathname.split("/")[1];
  if (!seg) return null;
  const cb = CODEBOOKS.find(
    (c) => c.status === "live" && c.sources.length === 1 && c.slug === seg,
  );
  return cb ? cb.sources[0] : null;
}

/** Tools that live in the right-side header dropdown, not next to codebook tabs. */
export type ToolLink = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  authRequired?: boolean;
};

import {
  Search as SearchIcon,
  Columns,
  MessagesSquare,
  Info,
} from "lucide-react";

export const TOOLS: ToolLink[] = [
  { label: "Search", href: "/search", description: "Keyword + phrase across every codebook.", icon: SearchIcon },
  { label: "Compare", href: "/compare", description: "Set the same phrase against multiple sources side by side.", icon: Columns },
  { label: "Forum", href: "/forum", description: "The Floor — discuss what you're researching.", icon: MessagesSquare },
  { label: "About", href: "/about", description: "What Marginalia is and why it exists.", icon: Info },
];