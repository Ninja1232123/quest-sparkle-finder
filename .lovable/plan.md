# Shared workspace: one screen, two operators

Right now the AI runs searches, opens documents, and reasons about your draft — but its tools execute server-side and the *results* live in chat messages. You see citation chips inside the assistant's bubble, not in your own search panel. So when the model says "look at § 1692a(6)," you have to click into the chat card to see what it saw.

This plan rewires the workspace so **every AI action lights up the user's own UI**. The model uses the same Search box, the same Reader, and the same Doc Creator you do. When it searches, your search box fills. When it opens a section, your reader opens that section. When it drafts, the text appears in your editor with a clear "AI wrote this" marker you can accept, edit, or revert. No hidden state, no separate AI surface to reconcile — one workspace, two cursors.

## What changes for the user

```text
┌─ Sources / Search ──┬─ Reader / Doc Creator ─┬─ Assistant ─────┐
│ [search box]        │  (statute text OR      │ chat            │
│ ▸ results (live)    │   user's draft)        │ "I searched X,  │
│   ↑ AI just         │  ↑ AI just opened      │  opened Y,      │
│     searched here   │    this for you        │  inserted Z"    │
└─────────────────────┴────────────────────────┴─────────────────┘
```

- **Search results stream into YOUR search panel**, not just chat. AI ran `scan_corpus`? The 80 hits populate the same list you'd see if you'd typed the query yourself — same UI, same click-to-open behavior. A small "↑ from assistant" tag shows the query and lets you re-run or pin it as your own.
- **Reader follows the AI's focus.** When the model fetches a document, your reader opens it on the same side it always opens on. The "Shared with assistant" badge already in place inverts: now the user sees what the AI is reading, too.
- **Draft edits arrive as visible diffs** in the Doc Creator. The model never silently overwrites — every AI insert/edit shows as a highlighted block with Accept / Edit / Revert. Multiple paragraphs queue up as a reviewable change set.
- **Citation chips** in the assistant's reply become live targets: hovering one previews the section in the reader; clicking it opens it; clicking the pin icon pins to the case board.
- **Activity strip** under the search box: a tight timeline of the AI's last ~10 actions ("searched 'nonjudicial foreclosure'", "opened § 1692a", "drafted 2 paragraphs into Argument II"). Each row is reversible: revert the action, re-run it as yours, or jump to what it touched.

## The model goes from "tools that return JSON" to "tools that drive the UI"

Today's tool functions only return data to the chat stream. We add a thin **workspace event channel** alongside the chat stream. Each tool call emits both:
1. its tool result (for the model's reasoning), AND
2. a UI event (for the user's screen).

UI events:
- `search.results(query, source, rows)` → populate Sources panel + add to activity strip.
- `doc.open(ref)` → open the reader on that document.
- `draft.insert(anchor, markdown)` → queue a pending insert in the Doc Creator with Accept/Revert chrome.
- `draft.replace(rangeQuote, markdown)` → queue a pending replacement (matched by quoted current text so we don't need server-side line numbers).
- `board.proposal(...)` → already exists as `propose_*`; unify under this channel.

The chat reply text stays short: "I pulled 80 hits on nonjudicial foreclosure — they're in your search panel. The most on-point looks like § 49-19; I opened it for you and queued a paragraph in Argument II." Reasoning lives in the actions the user can see.

## Concrete pieces

### New: live workspace bus (client)
A small event store in `workspace.$threadId.tsx` that the chat transport feeds. Tools whose output is "show the user this" call into the bus (via data parts on the SSE stream) instead of only returning a JSON blob to the model.

### New: `Sources` panel becomes the shared search surface
Replace the current `SourceReader` left column's static browser with a `WorkspaceSearch` component:
- Standard search input (what the user already expects).
- Result list that accepts results from EITHER the user's own submit OR the bus.
- Source-of-origin tag on each result group: 🧑 you searched this, ✨ assistant searched this.
- "Pin to case" and "Open" actions per row.

### Doc Creator: pending changes layer
- `EditorCanvas` gains a `pendingChanges` prop: `{ id, kind: 'insert'|'replace', anchor, markdown, fromAssistant: true }[]`.
- Pending blocks render inline with a left rail color + an Accept / Edit / Revert toolbar.
- Accept commits the change to `body_md` and clears the pending entry.
- A new server tool `propose_draft_edit({ kind, anchor, markdown, why })` replaces direct draft writes. The model never touches `body_md` server-side — it proposes, the user accepts.

### Activity strip
- Renders the last N bus events with timestamps and inline revert.
- Lives under the search box (or as a thin row across the workspace top — open question, see below).

### Server: emit UI events from tool calls
- In `chat.ts`, wrap the existing read-only tools so their `execute` also writes a `data-*` UI event part to the stream (AI SDK supports `dataStream.writeData` / typed data parts). Search tools emit `search.results`; `fetch_document` emits `doc.open`; the new draft tool emits `draft.insert` / `draft.replace`.
- The model still gets the JSON return value for reasoning. The user's screen consumes the parallel UI events.

### Cite-check + citations: same channel
Hovering an in-chat citation chip emits a transient `doc.preview(ref)` event that the reader honors as a peek. Click to lock open.

## What we deliberately keep

- The proposal-card flow for **pinning** authorities and questions. That's already user-driven and works — we just route it through the same bus so the activity strip lists "assistant proposed § 1983" alongside everything else.
- Constrained DRAFT_SYSTEM mode. The new draft tool replaces direct writes there too — proposed edits show up as a reviewable change set instead of dumping a wall of text into chat.
- The case board, autosave, versions.

## Out of scope this pass

- AI cursor presence ("the AI is reading line 42 right now") — fancy, not needed for the no-hallucination guarantee.
- Multi-user collaboration on the same thread.
- A second AI agent operating in parallel.

## A couple of choices I want you to weigh in on before I build

1. **Pending draft edits — auto-accept after N seconds, or always require an explicit Accept?** Explicit is safer; auto-accept is fewer clicks for a power user who trusts the model.
2. **Activity strip placement — under the search box, or a thin row across the top of the whole workspace?** Top is more visible but eats vertical space.
3. **Should accepting a proposal also tag the source as "from assistant" forever on the case board, or treat AI- and human-pins as identical once accepted?**

Once you pick, I'll ship it in order: workspace bus + UI event stream → search-panel wiring → reader wiring → pending-draft layer + new draft tool → activity strip → cite-chip previews.