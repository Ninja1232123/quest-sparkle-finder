# Marginalia — polish-to-professional punch list

Goal: from "damn good for 3 weeks" to a clean, professional legal product, so
week 4 is maintenance. Tiered by impact/risk. Check items off as they land.

## P0 — Wrong/stale, visible now (fast, low risk)
- [ ] **States nav still says "SOON"** — `src/lib/codebooks.ts` NAV_GROUPS: `State Law` (`:252`) and `State UCC enactments` (`:262`) `status:"soon"` → `"live"`.
- [ ] **Browse landing flattens 50 states** — `src/routes/code.index.tsx:176` maps *all* sources into one flat grid. Collapse state sources into the single "All 50 States →" card (already at `:212`) and filter states out of the flat federal grid.
- [ ] **Corpus sidebar States group** — `CorpusTree` accordions by group already; ensure the States group starts **collapsed** (50 items shouldn't auto-dump).

## P1 — Readability, reader & navigation (the core complaints)
- [ ] **Font scale too small** — nav/dropdowns/footers/badges lean on `text-xs`/`text-[11px]`/`text-[10px]`/`text-[9px]` (`SiteHeader`, `SiteFooter`, `CodebookLanding`). Bump base reading + nav one step, nudge line-height. Highest-impact visual fix.
- [ ] **Reader: Juri overlaps the body text** — inset the citation reading column / add a left gutter so the Juri launcher never overlays the text (pull the text column toward center). `src/routes/code.$.tsx` + `Juri` positioning.
- [ ] **Reader: line highlighter** — a reading ruler / current-line highlight in the reader for focus while reading long sections.
- [ ] **Search: top 3–5 per source (federated results)** — currently the candidate pool is balanced per-source but the *displayed* top-40 still re-ranks globally, so a big source can crowd out a small one (search "due process" → the Constitution, the smallest corpus, gets passed over). Change `search_documents_fts` to return top ~5 **per source**, grouped (UI already groups `bySource`); user explores a source deeper from there. Safer cross-corpus default. Cap # of source-groups shown on broad scopes so it doesn't explode.
- [ ] **Nav dropdowns feel thin** — "State Code" is a one-item dropdown; surface marquee states or a mini state picker. Tighten hover timing, width, soon-badge styling in `NavGroupTab`.
- [ ] **Header is busy** — 2 rows + a secondary link row (Browse / My Cases / What it does / Whitepaper / The Floor / About). Audit what needs to be top-level.

## P2 — Professional credibility (matters most for legal)
- [ ] **Kill fake stats** — `fakeThisWeek()` invents "new sections / amended / queries vs last week" (`CodebookLanding`, also placeholder bits in `code.index`, `compare`, `cases`). Make real (we have `search_events`, doc counts) or remove — fabricated numbers read as untrustworthy on a legal site.
- [ ] **Dev banner** — `DevNoticeBanner` ("Built sporadically by one person") — decide if it stays for a professional launch.
- [ ] **Trust signals** — persistent tasteful "not legal advice" line + a visible "law as published / last synced" stamp on reader pages (UPL guardrail + currency).

## P3 — Data polish
- [ ] **State section labels** — PA Constitution shows "Title 0"; some crumbs read "Chapter 1. Delaware Code" (corpus name doubled). Per-state label cleanup in the projection.
- [ ] **Empty/partial states** — NM 52/84 chapters (captcha), DC none; finish or label honestly so they don't look broken.

## P4 — Next features (horizon, not polish)
- [ ] **Caselaw** — SCOTUS/cases scope wired but empty; mostly ingest + citation-graph tie-in.
- [ ] **Semantic search** — hybrid/fastText path exists but parked; turning it on nails conceptual queries ("UCC for contracts").
