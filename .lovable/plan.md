# Case Board — user-driven research workspace

The user is the lead researcher "building a case." The AI never silently searches, pins, or drafts. It **proposes**, and the user accepts, edits, or rejects each step. Two earlier ideas — **adverse-authority finder** and **cite-check** — fold in as proposal types.

## The mental model

A thread becomes a **case file** with three stacks the user curates:

```text
┌─ Case Board (left of editor) ──────────┐
│  Supporting authorities  (3)           │
│  Adverse authorities     (1)           │
│  Open questions / to-search (2)        │
└────────────────────────────────────────┘
```

Everything the AI does flows through **proposals** the user has to accept.

## What changes

### 1. Data: per-thread case file
New table `workspace_case_items` (one row per pinned authority / open question):
- `id`, `thread_id`, `user_id`
- `kind`: `'authority' | 'question' | 'note'`
- `stance`: `'support' | 'adverse' | 'neutral' | null`
- `identifier` (e.g. `usc/42/1983`), `citation` (display), `heading`
- `pin_cite` (user-typed pin-cite, e.g. "(a)(2)")
- `quote` (user-selected operative language)
- `user_note` (why this matters to *their* case)
- `order_index`, `created_at`

RLS scoped to `auth.uid()`, GRANT to authenticated + service_role.

### 2. AI is rebuilt as a **proposal engine**
The chat tools stop executing side effects. Instead they emit *proposals* the user reviews:
- `propose_search({ query, why })` — renders a chip: "Run this search?" with Accept/Edit
- `propose_pin({ identifier, stance, suggested_quote, why })` — renders a pin card the user confirms (and can edit the quote / pin-cite before saving)
- `propose_adverse({ identifier, why_it_cuts_against })` — same UI, pre-tagged adverse
- `propose_question({ text })` — drops onto the Questions stack
- `cite_check_draft()` — read-only; lists each citation in the draft with "resolved / not found / not in your pinned set" so the user decides what to fix

System prompt updated: "Never act. Always propose. The user runs the search, the user picks the quote, the user pins the authority."

### 3. UI: three-pane Desk becomes four-pane
```text
┌── Case Board ──┬──── Editor ─────┬── Right Rail ──┐
│ Support (n)    │  Draft / Notes  │ Assistant      │
│ Adverse  (n)   │                 │ ── or ──       │
│ Questions (n)  │                 │ Search         │
└────────────────┴─────────────────┴────────────────┘
```
- Collapsible on narrow viewports; pinned-open on desktop.
- Each authority card: stance badge, citation (links to `/code/...`), pin-cite, quote, user note. Drag to reorder; "Insert into draft" pushes `> quote — citation, pin-cite` at cursor.
- ResultCard gets a third action: **Pin to case** → inline mini-form (stance, pin-cite, edit quote, why) → saves to board.
- Proposal cards in chat render with Accept / Edit / Dismiss; Accept calls the same server fn the manual UI uses, so AI- and human-added items are indistinguishable on the board.

### 4. Cite-check is user-triggered, read-only
Toolbar button in the editor: "Check citations." Runs `cite_check` against current `body_md`. Shows a side sheet listing each detected citation with status (✓ resolves, ✗ not found, ◇ not pinned to your board). User decides what to do — nothing is auto-fixed.

### 5. Safety on drafts (carry-over)
Autosave + flush-on-hide is already in. Add a **"Versions"** dropdown (last 5 autosaves kept in `workspace_draft_versions`) so a bad AI insert is one click to revert.

## Technical changes

- **Migration**: `workspace_case_items`, `workspace_draft_versions` with RLS + GRANTs.
- **`src/lib/workspace.functions.ts`**: `listCaseItems`, `upsertCaseItem`, `deleteCaseItem`, `reorderCaseItems`, `listDraftVersions`, `restoreDraftVersion`.
- **`src/routes/api/workspace/chat.ts`**: rewrite tools to `propose_*` (no DB writes). Keep `search_corpus` and `fetch_document` as read-only research tools the AI uses to ground proposals. `draft_document` removed — the user is the drafter.
- **New components**:
  - `src/components/workspace/CaseBoard.tsx` — three stacks, drag/reorder, insert-into-draft.
  - `src/components/workspace/PinDialog.tsx` — the mini-form for pinning an authority.
  - `src/components/workspace/ProposalCard.tsx` — rendered inside assistant message parts for `propose_*` tool calls.
  - `src/components/workspace/CiteCheckSheet.tsx` — read-only cite-check result.
- **Edited**:
  - `src/routes/workspace.$threadId.tsx` — adds left CaseBoard column, wires Insert/Pin handlers.
  - `src/components/workspace/ResultCard.tsx` — "Pin to case" action.
  - `src/components/workspace/EditorCanvas.tsx` — "Check citations" toolbar button, "Versions" dropdown.
  - `src/components/workspace/RightRail.tsx` — renders ProposalCards for `tool-propose_*` parts.

## Out of scope this pass
- Cross-thread "Library of authorities" (these stacks stay per-case for now).
- Public/shared casebooks (idea #10).
- Outcome stats overlay (idea #3) — separate ticket.

Once you accept the plan I'll ship it in order: migration → server fns → board UI → AI proposal tools → cite-check → versions.
