
# Workspace v2 — "The Research Desk"

A full redesign of `/workspace` into a 3-column research environment: left = notes & documents, center = distraction-free editor, right = AI assistant + corpus search (dockable as overlay). Keeps the existing Americana / serif + Special Elite vibe, pushes it toward a more serious, futuristic-realism aesthetic (deeper navy, brass micro-details, subtle grain, sharper rules, monospace metadata).

## Goals

- Real workspace, not a chat page. Editor is the protagonist; AI is the second seat at the desk.
- One screen does research → drafting → citation in one motion. No tab juggling.
- Corpus-aware: search/results hit the same statutes/cases users browse elsewhere on the site, and "Add to notes" / "Cite" push real anchored citations into the editor.
- Serious. No toy gradients, no purple glow. Deep navy, brass `#c8a24b`, paper cream, hairline rules, monospace eyebrows.

## Layout

```
┌─────────────┬───────────────────────────────────┬────────────────────────┐
│ LEFT 20%    │ CENTER ~50%                       │ RIGHT 30%              │
│ Sessions /  │ Document header (title, wc, save) │ AI + Corpus Search     │
│ Notes /     │ ─────────────────────────────────  │ ──────────────────────│
│ Docs tree   │ Floating format toolbar           │ Mode tabs:             │
│             │                                   │  [Assistant] [Search]  │
│ + New       │ Markdown editor (contenteditable) │                        │
│ Filter      │ Margin notes gutter (existing)    │ Results / Chat feed    │
│ Tabs:       │                                   │                        │
│  Sessions   │                                   │ Sticky composer        │
│  Notes      │                                   │                        │
│  Drafts     │                                   │ [⤢ Expand to modal]    │
│ Footer nav  │                                   │                        │
└─────────────┴───────────────────────────────────┴────────────────────────┘
```

Right panel has two states controlled by `useState<"dock" | "modal">`:
- `dock` — sticky 30% right rail.
- `modal` — centered overlay (max-w-3xl, paper bg, brass border) for deep-search mode; dims canvas, keeps editor visible behind. Toggled by the `⤢` button and by a "deep search" trigger from the search bar.

Mobile: collapses to a single column with bottom tab bar (Notes · Editor · AI). Out of scope for v1 polish but layout must not break.

## Left sidebar — Document & Notes Management

Three tabs at top (segmented control, monospace labels):
1. **SESSIONS** — current thread list (reuses existing `listThreads`). Grouped Today / Yesterday / This week / Older.
2. **NOTES** — user's saved margin notes / casebook entries (reuses `casebook.ts`). Tag chips + favorite star filter.
3. **DRAFTS** — documents generated in the workspace (reuses `listThreadDocuments`, expanded to user-wide).

Above tabs:
- `+ New Session` (primary, brass on navy).
- Filter input with `Search` icon, monospace.
- Tag chip row (horizontal scroll) — clicking a tag filters the active tab.

Collapsible: click chevron in header → collapses to 56px icon rail (icons only, tooltips on hover). Persisted in `localStorage`.

## Center canvas — Editor

Header strip (hairline bottom border):
- Document title (inline-editable, serif). Placeholder: "Untitled draft".
- Right side: word count, save state ("Saved · 2s ago" in monospace), `Open Research Assistant` button (toggles right panel into modal mode if collapsed).

Floating formatting toolbar:
- Appears on text selection, anchored above selection (Radix popover).
- Buttons: Bold, Italic, Underline, H2, Quote, Link, Highlight (3 colors), Inline code, `✨ AI Rewrite` (sends selection to assistant with "rewrite/tighten/cite" subactions).

Editor body:
- `contenteditable` div with markdown shortcuts (start with simple: `#`, `##`, `>`, `-`, `**`). No heavy editor framework v1 — keep it as a controlled `contenteditable` with sanitized HTML out. If complexity grows, swap to Tiptap later; not in scope now.
- Paper-cream background, serif body (Cinzel for headings, existing serif body), generous line-height, max-w prose.
- Left gutter shows margin-note dots (existing `Marginalia` pattern) when a note anchors to a paragraph.
- Drop target: dragging a result card from the right panel inserts a block-quote with citation footer at the cursor.

Empty state:
- Centered cream card: "Start typing, or ask the assistant to draft something." Below: the 4 existing prompt seeds as chips.

Autosave: debounce 800ms → server function `upsertDraft({ threadId, title, contentMd })`. Reuses workspace.functions pattern.

## Right panel — AI Assistant + Corpus Search

Top segmented tabs: **ASSISTANT** · **SEARCH**.

### Search mode
- Conversational search input ("Ask the corpus or type a citation…").
- Filter chips below input: `Jurisdiction`, `Source` (USC/CFR/Cases/State), `Year range`, `Court`. Each opens a small popover; selected filters show as removable chips.
- Streaming result cards:
  - Title (serif), citation (monospace), 2-line snippet with matched terms highlighted in brass.
  - Metadata row: source badge, year, court/agency.
  - Actions: `➕ Add to Notes` (inserts block-quote + citation at cursor), `📝 Summarize` (assistant tab takes over, streams summary), `↗ Open` (opens source in new tab), drag handle.
- Skeleton shimmer cards while streaming (3 placeholder cards with `animate-pulse`).

### Assistant mode
- Existing AI-elements `Conversation` / `Message` / `Tool` stack (already wired). Reuse `/api/workspace/chat`.
- Tool results from the agent's corpus-search tool render as the same cards described above (consistent UI between modes).
- Sticky `PromptInput` at bottom. Stop button while streaming. Shimmer "Thinking…" while submitted.
- Streaming caret already provided by AI-elements; keep.

### Modal overlay
- `⤢` icon in panel header swaps dock ↔ modal.
- Also auto-opens modal on `⌘K` "deep search".
- Modal: 760px wide, max 80vh, brass 1px border, soft shadow, paper bg. Clicking backdrop or `Esc` returns to dock.

## Visual system additions (in `src/styles.css`)

- New tokens: `--brass`, `--brass-soft`, `--navy-deep`, `--rule-hair`.
- Utility `@utility hairline { border-color: color-mix(in oklab, var(--ink) 12%, transparent); }`.
- Subtle film-grain SVG noise as `::before` on the canvas at 3% opacity (futuristic-realism cue without breaking serif Americana).
- Mono eyebrows uppercase tracking-[0.3em] (already used) — formalize as `.eyebrow` utility.
- Button: add a `brass` variant (navy bg, brass border, brass text on hover).

## State & persistence

- Right panel mode: `useState<"dock" | "modal">`, persisted in `localStorage("workspace.rightMode")`.
- Left sidebar tab + collapsed state: `localStorage`.
- Editor content: autosaved to `documents` table via server fn (threadId-scoped). No new schema unless current `documents` table can't hold markdown — will verify on implementation.

## Data wiring

Reuses existing server functions where possible:
- `listThreads`, `createThread`, `deleteThread` — sessions tab.
- `getThreadMessages`, `/api/workspace/chat` — assistant.
- `listThreadDocuments` (extend with `listUserDocuments`) — drafts tab.
- `casebook.ts` notes — notes tab.
- New small server fns: `upsertDraft`, `searchCorpus` (wraps existing search RPC used elsewhere on the site).

No DB migration expected v1. If `documents` lacks a `content_md` column, a single migration adds it.

## Out of scope (v1)

- Real-time collaboration / presence.
- Rich Tiptap/ProseMirror editor (stay on `contenteditable` first).
- Mobile-perfect 3-column collapse beyond "doesn't break".
- Reordering/folder nesting in the left tree (flat list + tags first).

## File plan

- `src/routes/workspace.$threadId.tsx` — replace body with new 3-col shell.
- `src/components/workspace/LeftPanel.tsx` — sessions/notes/drafts tabs.
- `src/components/workspace/EditorCanvas.tsx` — header + toolbar + contenteditable.
- `src/components/workspace/FormatToolbar.tsx` — floating selection toolbar.
- `src/components/workspace/RightPanel.tsx` — tabs + dock/modal shell.
- `src/components/workspace/SearchPane.tsx` — search input + filters + result cards.
- `src/components/workspace/ResultCard.tsx` — shared card used by search and tool results.
- `src/components/workspace/AssistantPane.tsx` — thin wrapper around existing AI-elements stack.
- `src/lib/workspace.functions.ts` — add `upsertDraft`, `searchCorpus`, `listUserDocuments`.
- `src/styles.css` — new tokens + `.eyebrow`, `.hairline`, grain utility.

## Open questions before build

1. Keep `contenteditable` for v1, or jump straight to Tiptap? (Tiptap = better markdown but +1 day of work.)
2. Should NOTES tab show all user notes site-wide, or only notes anchored to docs cited in this session?
3. Drafts: per-thread only, or a global "My drafts" list that can be reattached to any thread?
