# Marginalia — polish-to-professional punch list

Goal: from "damn good for 3 weeks" to a clean, professional legal product, so
week 4 is maintenance. Tiered by impact/risk. Check items off as they land.

## P0 — Wrong/stale, visible now (fast, low risk) ✅ DONE (de4cb7d)
- [x] **States nav still says "SOON"** — NAV_GROUPS State Law + State UCC enactments → "live".
- [x] **Browse landing flattens 50 states** — states filtered out of the federal grid + collapsed into one "All 50 States" card; stale coming-soon card removed.
- [x] **Corpus sidebar States group** — already defaults collapsed (only `federal` open). No change needed.

## P1 — Readability, reader & navigation (the core complaints) ✅ mostly DONE
- [x] **Font scale too small** — bumped nav links (13→14px), codebook tabs (14→15px), Pro CTA (13→14px), Tools button (13→14px), dropdown items (xs→13px), Tools item label/desc, soon-badges (9→10px), brand sublabel (10→11px), codebook-strip label (9.5→10.5px), footer disclaimer (11→12px). `styles.css` + `SiteHeader` + `SiteFooter`.
- [x] **Reader: Juri overlaps the body text** — article now has a `lg:pl-16` left gutter (pulls the column toward center, clearing the fixed bottom-left Juri launcher) with a faint ruled-margin line in the gutter. `code.$.tsx`.
- [x] **Reader: line highlighter** — "Ruler" toggle in the reader toolbar; a translucent ochre band tracks the cursor's line (fixed, pointer-events-none, persists in localStorage). `code.$.tsx`.
- [x] **Search: top 3–5 per source (federated results)** — `search_documents_fts` rewritten to return top-K **per source** (display 6), order source groups by their best hit, cap at 14 groups for broad scopes. Verified: "contracts" now surfaces UCC (2nd) + IRM (4th); "due process" keeps the Constitution. Cache flushed + re-warmed (`search-rerank.sql`, `search-prewarm.sql`, `p_limit` 40→120 in `documents.functions.ts`).
- [x] **Nav dropdowns feel thin** — "State Code" dropdown now lists California / Texas / New York / Florida marquee states under "All 50 States". `codebooks.ts`.
- [x] **Header is busy** — dropped **Whitepaper** from the top nav (still linked in-context from About/Features/Subscribe). Kept: Browse (the one-page index of everything), My Cases (central feature), The Floor, About. Roadmap notes:
  - **What it does** → revamp into a **"Start Here" walkthrough** (annotated screenshots of the read → notes → casefile → filing flow). Rename the nav label when that page ships.
  - **The Floor** → keep if users engage; otherwise repurpose the slot as an **SEO blog** (posts that rank + funnel to the corpus).

## P2 — Professional credibility (matters most for legal) ✅ DONE (fc631d4)
- [x] **Kill fake stats** — removed `fakeThisWeek()` ("new sections / amended / queries vs last week") from `CodebookLanding`; replaced with a verify-the-source note.
- [x] **Dev banner** — removed (`DevNoticeBanner` deleted) for a clean launch.
- [x] **Trust signals, NO currency claims** — per the rule "no claims of most-up-to-date data unless we actually maintain it": stripped every "updated/indexed May 2026" stamp (home, code index, search, codebook hero+landing) and added "research copy — check the official state/federal source · not legal advice" lines on the reader, search results, and codebook landing. (We deliberately do NOT show a "last synced" date.)

## P3 — Data polish
- [ ] **State section labels** — PA Constitution shows "Title 0"; some crumbs read "Chapter 1. Delaware Code" (corpus name doubled). Per-state label cleanup in the projection.
- [ ] **Empty/partial states** — NM 52/84 chapters (captcha), DC none; finish or label honestly so they don't look broken.

## P4 — Next features (horizon, not polish)
- [ ] **Caselaw** — SCOTUS/cases scope wired but empty; mostly ingest + citation-graph tie-in.
- [ ] **Semantic search** — hybrid/fastText path exists but parked; turning it on nails conceptual queries ("UCC for contracts").
