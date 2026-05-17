# Information architecture for the expanded corpus

~4 corpora becoming ~15, with Federal Register and Congress bringing 500k+ documents. The current `/code/$identifier` catch-all + 4-link header collapses under that. The fix is two layers working together:

1. **A wider, persistent top nav** that lists every codebook by name so the user never has to "go find" a corpus.
2. **A purpose-built landing page per codebook** so a 600k corpus and a 30k corpus each feel right-sized, not the same.

This is navigation/IA first, as you asked. Schema work comes after the first FR/Congress dump lands.

## One tab per codebook (not 5 shelves)

Reversing my earlier suggestion. Twelve codebook tabs across the header, each going to its own landing — *not* five mega-shelves that bury everything. With ~10–12 entries we can use the full header width that's currently empty, and every corpus is one click from anywhere.

```text
Tab               Route             Approx scale     Browse model
──────────────────────────────────────────────────────────────────────
Constitution      /const            ~30 sections     Articles + Amendments grid
U.S. Code         /usc              ~60k sections    Title → Chapter → Section
CFR               /cfr              ~250k sections   Title → Chapter → Part → Section
Statutes          /statutes         ~?               Year → volume (Statutes at Large + compilations)
Bills             /bills            ~300k            Congress → chamber → bill #
Public Laws       /laws             ~?               Congress → law #
Fed. Register     /register         ~200k+           Year → month → agency
Pres. Docs        /presidential     ~?               Year → type (EO, proc., papers)
SCOTUS            /scotus           ~?               Decade → year → case
Agency Manuals    /agency           IRM, TFM, USGM   By agency
Model Codes       /model            UCC + future     By code
States            /states           future           Placeholder, disabled until data
──────────────────────────────────────────────────────────────────────
Tools menu (right side, dropdown): Search · Cases · Stacks · Compare · Forum · About
```

Why one-tab-per-codebook instead of shelves:
- A single "Federal" tab hiding 12 codebooks defeats the goal of "no hunting for what you want."
- Volume imbalance becomes the user's problem ("why is this tab so much bigger?") instead of an internal layout problem we can solve per-page.
- Tabs read like a library directory — the brand is "a citizen's law index" and the header should feel like the spine of an index.

## Using the empty space — header layout

Current header has logo + 4 links + search and the rest is whitespace. Replacing with a two-row arrangement that scales to 12+ tabs without crowding:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  ▣ Marginalia          [ Search keywords or a citation... ]   ☼  ⎋    │  Row 1: brand + search + utility
│  a citizen's law index                                                  │
├────────────────────────────────────────────────────────────────────────┤
│  Const  USC  CFR  Statutes  Bills  Laws  Register  Pres  SCOTUS  …  ⋯ │  Row 2: codebook tabs
└────────────────────────────────────────────────────────────────────────┘
```

- Row 2 is a single horizontal scroller on narrow viewports, but at desktop widths every tab is visible.
- Hovering a tab opens a **mega-panel** below it (no navigation needed) showing: scale, last update, and 2–4 quick-browse links (e.g. "Browse 2026 issues", "By agency", "Most-cited rules this week"). That kills "I have to click in and scroll to see what's here."
- Right end has a `⋯ More` overflow for anything that doesn't fit and the Tools menu (Cases / Stacks / Compare / Forum / About).
- The existing left-rail `CorpusTree` stays as the reading-time navigator inside a codebook, not the discovery surface.

## Per-codebook landing pages

Each landing is built for *its* scale, not from a template. The point is that a 600k corpus and a 30k corpus shouldn't share a layout.

- **Small & stable (Constitution, UCC, USGM):** full table of contents on one page, no pagination. Reader-first.
- **Medium hierarchical (USC, CFR):** Title grid with section counts, plus a "jump to citation" input. What you have today, polished.
- **Large time-series (Federal Register, Bills, Pres. Docs, Statutes at Large):** big year picker (current year highlighted), month-by-month density heatmap, top agencies/sponsors strip, recent activity feed. No "all documents" list — that's what search is for.
- **Case-driven (SCOTUS):** decade ribbon, recent additions, case-name search; eventually topic clusters.
- **Agency manuals:** card per agency (IRM, TFM, etc.) with last-updated and direct deep links.

Time-based browse is the default for the four time-series corpora, per your note. Agency/sponsor surfaces only show up where the data is clean.

## URL shapes

Each codebook owns a top-level path. Readers stay deep but each one's lineage is obvious from the URL.

```text
/const                                shelf landing
/const/amendment-14                   reader

/usc                                  shelf landing
/usc/42/1983                          reader (currently /code/usc/42/1983)

/cfr/42/438                           reader
/register/2026/05                     month browse
/register/agency/epa                  agency browse
/register/doc/2026-12345              reader
/bills/119/hr/1234                    bill reader (status timeline + versions)
/laws/119-12                          public law reader
/scotus/1972/brown-v-board            case reader
/agency/irm/2026/4-10-1               reader
```

Old `/code/usc/...` URLs 301 to `/usc/...`. The agent API (`/api/public/v1/*`) keeps working — only the `url` field shape changes; `identifier` stays the same key.

## Code changes (IA-first pass)

Frontend only. No DB, no ingest.

1. **New shelf + reader route files** for each codebook listed above (`src/routes/usc.tsx`, `usc.index.tsx`, `usc.$.tsx`, etc.). Empty scaffolds with `head()` SEO and a "coming soon" stub where data isn't wired yet.
2. **Migrate the existing reader**: `/code/$.tsx` → per-codebook `$.tsx` files. Keep `/code/$.tsx` as a 301 redirect.
3. **Rebuild `SiteHeader`** as the two-row layout with the 12 tabs, mega-panel on hover, and Tools dropdown on the right. Falls back to a horizontal scroller below `lg`.
4. **Demote/relocate existing pages** into the Tools dropdown: `Library`, `Chambers`, `Stacks`, `Compare`, `Cases`, `Forum`, `About`. None of these belong next to a codebook tab.
5. **Update sitemap** to enumerate all codebook landings.
6. **Add a `Coming Soon` codebook marker** so I can add a tab now (e.g. States, Public Papers) before data lands and the page still feels intentional.

## What's deferred (schema pass — after first FR/Congress upload)

- New columns/tables for FR (publication_date, agency, rule_type, effective_date), Bills (congress, chamber, bill_type, sponsor, status, version), SCOTUS (decided_date, docket, justices).
- Whether to extend `documents` with a `shelf` + JSONB metadata column, or split into `register_docs`, `bills`, `court_opinions`. Depends on how uniform the GovInfo XML/uslm payloads turn out.
- Cross-source citation graph (FR rule → CFR section it amends; bill → USC it amends).
- Per-shelf search ranking (an FR notice shouldn't outrank a USC section on a statute query).
- Materialized counts per codebook so the mega-panel and landing headers show real numbers.

## Open questions before I execute

1. **Tab list** — does the 12-tab list above match your mental model, or do you want different splits (e.g. split Federal Register into Rules / Notices / Pres-docs as separate tabs, since FR alone is the largest single corpus)?
2. **States** — show the tab now as a disabled "Coming" placeholder, or hold it until at least one state lands?
3. **Existing pages** — agree to move `Library / Chambers / Stacks / Compare / Cases / Forum / About` into a right-side Tools dropdown? Anything you'd keep top-level?

Answer those three and I'll do the IA pass: rebuild the header, scaffold the 12 codebook routes with landings, 301 the old `/code/*` paths, refresh the sitemap.