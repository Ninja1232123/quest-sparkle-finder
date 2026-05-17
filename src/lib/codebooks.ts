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
    status: "soon",
    kind: "time",
    sources: ["fedregister"],
    accent: "#c45a2c",
    icon: Newspaper,
  },
  {
    slug: "bills",
    tab: "Bills",
    name: "Congressional Bills",
    tagline: "Every bill and resolution introduced in Congress, with status and text versions.",
    status: "soon",
    kind: "time",
    sources: ["bills"],
    accent: "#5b3a8a",
    icon: Vote,
  },
  {
    slug: "laws",
    tab: "Public Laws",
    name: "Public & Private Laws",
    tagline: "Bills enacted into law, by Congress and number.",
    status: "soon",
    kind: "time",
    sources: ["plaw"],
    accent: "#0a1f44",
    icon: ScrollText,
  },
  {
    slug: "statutes",
    tab: "Statutes",
    name: "Statutes at Large & Compilations",
    tagline: "Bound annual volumes of every law passed by Congress.",
    status: "soon",
    kind: "time",
    sources: ["statute", "statcomp"],
    accent: "#6b3a2a",
    icon: BookOpen,
  },
  {
    slug: "presidential",
    tab: "Presidential",
    name: "Presidential Documents",
    tagline: "Executive orders, proclamations, and public papers of the presidents.",
    status: "soon",
    kind: "time",
    sources: ["presdoc", "pppus"],
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
    slug: "model",
    tab: "Model",
    name: "Model & Uniform Codes",
    tagline: "Model commercial law and uniform acts adopted by the states.",
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
    status: "soon",
    kind: "small-toc",
    sources: [],
    accent: "#4a6741",
    icon: MapPin,
  },
];

export function getCodebook(slug: string): Codebook | undefined {
  return CODEBOOKS.find((c) => c.slug === slug);
}

/** Map a `source_code` value back to the codebook that owns it. */
export function codebookForSource(source: string): Codebook | undefined {
  return CODEBOOKS.find((c) => c.sources.includes(source));
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
  BookMarked,
  Library as LibraryIcon,
  Columns,
  MessagesSquare,
  Info,
} from "lucide-react";

export const TOOLS: ToolLink[] = [
  { label: "Search", href: "/search", description: "Keyword + semantic across every codebook.", icon: SearchIcon },
  { label: "Compare", href: "/compare", description: "Set the same phrase against multiple sources side by side.", icon: Columns },
  { label: "Stacks", href: "/stacks", description: "Pre-built reading stacks for common situations.", icon: LibraryIcon },
  { label: "Cases", href: "/cases", description: "Your bookmarked sections, tagged and noted.", icon: BookMarked, authRequired: true },
  { label: "Forum", href: "/forum", description: "The Floor — discuss what you're researching.", icon: MessagesSquare },
  { label: "About", href: "/about", description: "What Marginalia is and why it exists.", icon: Info },
];