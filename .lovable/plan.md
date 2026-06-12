# 75-Credit Sprint Plan

A focused pass to (1) finish the AI workspace properly, (2) wire it into the rest of the site so research actually flows, and (3) polish the long tail of pages that haven't gotten the distinctive-frontend treatment yet. Sequenced so each phase ships something usable before the next starts.

&nbsp;

####You could combine the 'My Cases' and the 'document builder' into the workspace module. The margin notes already have an @CaseName feature to paste notes to specific case files. @Juri commands would be pretty neat. Meshes well with the cross-site interactives. Go heavy on the AI workspace and integration. If we have any left over after that, statute page polish and ToC polish would be the second thing to perfect####

---

## Phase 1 — Workspace finish line (~15 credits)

The workspace shipped functional but rough. Tighten before adding more.

- **Sidebar polish**: collapsible groups (Today / Yesterday / Older), rename-in-place, hover-only delete (already partially there), session count, search threads input.
- **Artifacts drawer**: right-side slide-out on `/workspace/$threadId` listing `workspace_documents` for the thread. Click → preview; buttons for DOCX / PDF / MD export.
- **Model picker** in composer footer (gemini-3-flash default, gpt-5.4 for heavy drafting). Persist per-thread in `workspace_threads.model`.
- **Streaming UX**: stop button, regenerate-last, copy message, token shimmer on tool calls.
- **Empty state**: prompt suggestions ("Draft a motion to dismiss…", "Cite-check this paragraph…", "Find § on qualified immunity").
- **Keyboard**: ⌘K new session, ⌘/ focus composer, ↑ edit last message.

## Phase 2 — Cross-site AI continuity (~12 credits)

The whole pitch is "research → workspace handoff." Make it real everywhere.

- **"Send to workspace" affordance** on every doc view (`/code/*`, `/case/*`, `/cases/*`, `/const`, `/cfr`, etc.). Button seeds a thread with the doc as context.
- **Selection → ask Juri**: highlight text on any doc page → floating "Ask Juri about this" pill → opens popup with the selection quoted.
- **Juri popup upgrades**: model can now call `search_corpus` and `fetch_document` (share tool definitions with workspace route). Inline citation chips link to `/code/*`.
- **Workspace can deep-link back**: when the model cites a doc, the chip opens in a side-preview iframe instead of leaving the workspace.
- **Bookmarks integration**: workspace tool `add_bookmark({ identifier, note })` so the model can save references the user can revisit.

## Phase 3 — Page polish pass (~25 credits)

Hit every page that still looks like default shadcn. Use the codex/Cinzel/Special Elite system already established.

Priority order (highest-traffic first):

1. `/code` landing + `/code/source/$source` — hero, corpus tree polish, recently-viewed
2. `/cases`, `/case/$clusterId`, `/cases/$id` — case header treatment, citation graph sidebar
3. `/outcomes/*` — data-viz polish, sticky filter rail, sparklines
4. `/forum`, `/forum/$slug/$id` — thread cards, reply composer, vote affordances
5. `/about`, `/how-it-works`, `/whitepaper`, `/features` — editorial layouts
6. `/account`, `/subscribe`, `/checkout.return` — trust polish, plan cards
7. `/auth`, `/register` — full-bleed split with marginalia illustration
8. `/search` results — result card hierarchy, source filter chips, hit highlighting refinement

Cross-cutting:

- **404 / error boundary** with the codex theme (currently default).
- **Mobile nav** sweep — `MobileExperienceNotice` is fine, but the header on mobile needs work.
- **Footer**: real sitemap-style footer with the corpus tree summarized.

## Phase 4 — Perf + SEO + trust (~13 credits)

- **Per-route `head()**`: audit every route for unique title/desc/og. Several leaf routes still inherit root.
- **JSON-LD**: `LegalService` schema on home, `Article` on whitepaper, `Dataset` on outcomes, `FAQPage` on how-it-works.
- **OG images**: dynamic OG for `/code/*` and `/case/*` via a `/api/og/*` route (TanStack server route + satori).
- **Sitemap**: verify all the new workspace-excluded routes aren't leaking; ensure `noindex` on `/workspace/*`.
- **Disclaimer footer link**: link the bar disclaimer to a full `/disclaimer` page (terms-of-use lite).
- **Lighthouse pass**: image sizing, font preconnect for Cinzel/Special Elite, LCP on landing.

## Phase 5 — Stretch (~10 credits, only if budget remains)

Pick 1–2:

- **Saved searches** with email/push alerts (pg_cron + edge function).
- **Diff view polish** on `/compare_/diff` (current is basic).
- **Public share links** for workspace documents (`/d/$publicId` read-only).
- **Voice input** on workspace composer (Web Speech API).

---

## Technical notes

- All workspace tools live in `src/routes/api/workspace/chat.ts`; share with Juri by extracting to `src/lib/ai-tools.server.ts`.
- "Send to workspace" reuses `seedThreadFromHandoff` — extend to accept `{ contextDocs: string[] }` and prepend a system-style user message with quoted text.
- Artifacts drawer: new server fn `listThreadDocuments(threadId)` + realtime via polling on stream end (skip realtime sub for v1).
- OG image route: `src/routes/api/og/$.ts` with `satori` + `@resvg/resvg-wasm` — WASM build works on Workers.
- Model picker: add `model text` column to `workspace_threads` (migration), pass into chat route.

---

## How I'd execute

I'd go phase-by-phase, shipping each as a coherent chunk so you can sanity-check before I move on. Phase 1+2 are the highest leverage — they make the workspace feel real. Phase 3 is the most credit-hungry but most visible. Phase 4 is the "make Google + lawyers respect this" pass.

**Question for you before I start:** which of these matters most? I can:

- (A) Do all 5 phases in order, stopping when credits run out -
- (B) Skip Phase 3 polish and go deep on workspace/AI features (Phases 1, 2, 5)
- (C) Skip workspace tweaks and just polish pages (Phase 3, 4)
- (D) Your own mix — tell me what to drop/add