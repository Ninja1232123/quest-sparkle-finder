# AI Legal Workspace

A new `/workspace` section — a chat-driven CLI-style workspace where a model uses tools to research the corpus, draft legal documents, cite-check, and export. Threaded sessions, database-backed history, and a handoff from the existing popup chat.

## Pages & routes

- `/_authenticated/workspace.tsx` — layout. Left rail = thread list + "New session"; right = `<Outlet />`. Empty state under `/workspace` redirects to newest or creates one.
- `/_authenticated/workspace.$threadId.tsx` — the actual chat surface. Composer at bottom, transcript above, right-side "Artifacts" drawer listing generated documents for that thread (download DOCX/PDF, open in viewer).
- `/api/workspace/chat.ts` — TanStack server route. AI SDK `streamText` with tools, `requireSupabaseAuth`-equivalent (verifies bearer, scopes to user, validates `threadId` ownership).

## Backend (Lovable Cloud — schema kept generic/portable)

New tables (all RLS-scoped to `auth.uid()`):
- `workspace_threads` — `id`, `user_id`, `title`, `summary`, `last_message_at`.
- `workspace_messages` — `id`, `thread_id`, `role`, `parts` (jsonb — AI SDK UIMessage parts), `created_at`. Stores the full `UIMessage` so tool calls/results render on reload.
- `workspace_documents` — `id`, `thread_id`, `user_id`, `kind` (motion/complaint/letter/contract/memo/other), `title`, `body_md`, `citations` (jsonb), `created_at`. Generated drafts live here so they survive across sessions and can be re-exported.

Server functions (`src/lib/workspace.functions.ts`):
- `listThreads`, `createThread`, `renameThread`, `deleteThread`
- `getThreadMessages(threadId)`
- `listThreadDocuments(threadId)`, `getDocument(id)`
- `seedThreadFromHandoff({ messages })` — used by the popup-chat "Continue in workspace" button.

## AI tools the model can call (server-side, in the chat route)

1. `search_corpus({ q, source?, limit })` → wraps existing `search_documents_fts` / `search_hybrid` RPCs. Returns identifier, citation, snippet, url.
2. `fetch_document({ identifier })` → reads `public.documents`, returns body_text + outgoing citations.
3. `draft_document({ kind, title, body_md, citations })` → inserts into `workspace_documents`, returns id. The UI auto-renders a doc card in the transcript and in the artifacts drawer.
4. `cite_check({ text })` → extracts citations via regex, looks each one up in `documents`, returns `{ found: [...], missing: [...], suspicious: [...] }`.
5. `export_document({ document_id, format: "docx" | "pdf" })` → reuses existing `src/lib/docx-export.ts` for DOCX; PDF via the existing paged.js setup. Returns a signed download URL.

Loop control: `stepCountIs(50)`. System prompt frames it as a pro-se legal research/drafting assistant with strict "quote, cite, link" rules and a "not legal advice" footer.

## UI

- Use AI Elements (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`) installed via `bun x ai-elements@latest add ...`.
- Tool calls render collapsed by default (params hidden; corpus hits/doc previews shown as compact cards inline).
- Composer = `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` with submit. Keep textarea focused per chat-agent contract.
- Codex theme: dark navy panel, Cinzel headings, Special Elite monospace for the CLI feel — matches the rest of the site.
- Header: add "Workspace" link to `SiteHeader.tsx` (auth-gated; shows when signed in).

## Popup chat handoff

In `src/components/marginalia/Juri.tsx` (the popup chat), add a "Continue in workspace" button that:
1. POSTs the current chat's `UIMessage[]` to `seedThreadFromHandoff`.
2. Navigates to `/workspace/$newThreadId`.
3. The new thread renders the prior conversation and the model picks up where the user left off.

## Database-agnostic note

All workspace logic goes through `src/lib/workspace.functions.ts` (server fns) — no Supabase imports leak into components. Swapping the backend later means rewriting that one file plus the chat route's tool handlers; UI/AI-SDK layer is untouched.

## Out of scope for v1 (call out so we can do later)

- Realtime multi-tab sync
- Collaborator sharing
- Voice input
- Auto-running cite-check on every assistant turn (manual tool call only)

## Technical details

- Stack: TanStack Start `createServerFn` + `/api/workspace/chat` server route, AI SDK + `@ai-sdk/openai-compatible` via existing `createLovableAiGatewayProvider` helper. Default model: `google/gemini-3-flash-preview`; user can switch to `openai/gpt-5.4` for harder drafting.
- Auth: routes under `_authenticated/`. Chat route verifies bearer + thread ownership before streaming.
- Storage: workspace docs stored as markdown in the row; DOCX/PDF generated on demand into the existing `docs` bucket with signed URLs, scoped to the user.
- Messages persisted in `onFinish` via `toUIMessageStreamResponse({ originalMessages, onFinish })` so tool calls/results survive reloads.

Confirm and I'll build it.
