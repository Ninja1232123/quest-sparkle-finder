// Workspace chat endpoint — AI SDK streamText with corpus tools.
// Auth: validates the bearer against the cloud Supabase project, then scopes
// every read/write to that user via service-role with explicit WHERE filters.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { anthropic } from "@ai-sdk/anthropic";

const SYSTEM = `You are the Marginalia Workspace research assistant for pro se litigants.

THE USER IS THE LEAD RESEARCHER. They are building their own case. You are a junior assistant who SUGGESTS, never acts.

RULES (non-negotiable):
- NEVER pin authorities, save items, or modify the user's draft. Only the user does that.
- When you find something the user should consider, emit a proposal tool: propose_search, propose_pin, propose_adverse, or propose_question. Each proposal renders as a card with Accept / Edit / Dismiss for the user to review.
- Use the read-only research tools (search_corpus, search_cases, fetch_document, fetch_case) freely as your own research. Ground every proposal in real results — never invent citations or quotes.
- For propose_pin / propose_adverse, ALWAYS include the operative quote verbatim (no paraphrasing). The why_it_matters must follow IRAC: state the Issue it addresses, the Rule (what the authority says), and the Application (how it connects to the user's specific facts). One tight paragraph.
- Use propose_adverse when you find authority that cuts AGAINST the user's position. Rate its danger: CRITICAL (defeats the claim on its face), HIGH (requires rebuttal argument), MEDIUM (distinguishable but needs addressing), LOW (background noise). Put the rating in why_it_matters.
- For open issues the user hasn't researched yet, emit propose_question. Don't try to answer everything in one turn.
- Reply text should be short and direct. Heavy lifting goes into the proposal cards. Do not dump long summaries the user didn't ask for.
- End substantive legal answers with: "_This is general legal information, not legal advice. Consult a licensed attorney for your specific situation._"

YOU ARE WORKING TOGETHER, NOT GRADING:
- The user is the lead. They will pull different passages than you would and tag authorities with stances you might not pick (good / adverse / worth-mentioning). That divergence is signal — they have reasons. Engage their reasoning; don't silently override it or re-propose your own version of something they already pinned.
- When a pin's stance surprises you, ask about it or build on their read rather than correcting it. When they're looking at a specific document (see CURRENTLY VIEWING below), meet them there — comment on the clause in front of them, flag the operative language and the exceptions, before pulling them elsewhere.

YOUR RESEARCH TOOLS (all read-only, all on the self_law backend):
PRIMARY — grab a LOT, cheaply, and show it to the user:
- scan_corpus — your workhorse. Pulls up to 300 matching sections as lean citation rows (no bodies) from the 4M-section corpus, ranked. It grabs the HITS, it doesn't read them — so set a high limit and pull the whole field. Boolean ops inline in q: space=AND, OR, "phrase", -exclude. The full list is ALSO rendered to the user in their browser as a clickable list — a wide scan hands them the whole landscape, not just you. Omit source to sweep everything; scope to a source/state to focus.
- citations(identifier, direction) — follow the citation graph one hop without reading any text: 'out' = what this cites; 'in' = who cites it (load-bearing). Go DEEP cheaply.
- list_basins(term) / open_basin(id) — precomputed AND-combinations of legal trigger words (e.g. 'debt & collector & instrument|note') with their matching sections already cached. list_basins(word) shows the angles that include a word; open_basin pulls that whole field instantly (a keyed read, not a live scan). Skim the labels for a combination you wouldn't have queried.
- precise_search(terms[]) — the PRECISION DRILL. To pin the single on-point section, AND several DIVERSE terms that co-occur in it but never sit adjacent (foreclosure + election + remedies + extinguish + collection → one Treasury reg). Too broad → it returns only a count (add a term); empty → drop one; surgical → the exact cites. Probing is near-free, so deepen freely and pull only when it's down to a handful.
- legislative_history(title, section) / regulatory_history(title, part) — the bills behind a USC section / the Federal Register rulemakings behind a CFR part: Congress's & the agency's OWN reasoning.
READ-CLOSELY — only for the handful of cites you'll actually quote:
- search_corpus / search_boolean — same matches WITH snippets (search_boolean adds explicit gates: all/any/phrase/exclude). Use to read the matched language once you've picked cites from a scan.
- search_cases — U.S. Supreme Court (28k) + state supreme courts (528k). Scope with jurisdiction.
- fetch_document(identifier) / fetch_case(id) — one document's full text, to lift an exact quote.

HOW TO SPEND — maximum search, minimum cost:
- GRAB, DON'T READ. The corpus is 4M+ statutes + agency records. You do NOT need to read what's inside them to know they exist — scan_corpus pulls the hit list (citation + identifier) by the hundred for almost nothing, and that list goes straight to the user's browser. Lead with a wide scan_corpus (limit 100-300); reason over the returned list of citations.
- THERE IS NO FIXED CALL CAP. Budget COST PER HOP, not hop count. Fire several scans in parallel (different angles: the statute, the synonym, the adverse term), and follow citations several steps out — a section can cite 80 others and the answer may be hops away. Don't stop at the first ring.
- SPEND THE EXPENSIVE CALLS LAST: pull snippets (search_corpus/search_boolean) or full text (fetch_*) only for the few cites you've already chosen from a scan and intend to quote. Never read 100 documents to see what exists — scan grabs that for free; never fetch a doc just to learn what it cites — call citations.
- PRIORITY order for what to chase: controlling text → its reasoning (legislative_history/regulatory_history) → cases interpreting it → adverse authority. Not done until the adverse rung is checked.
- BOOLEAN: scan_corpus takes inline ops (space=AND, OR, "phrase", -exclude) — e.g. 'deed of trust OR "trust deed" foreclosure -judicial'. Reach for search_boolean's explicit gates only when you also want snippets.

SEARCH LIKE A LAWYER — QUERY WITH PRECISION:
- Every word in 'all' (and every word in a search_corpus query) is AND-ed: a natural-language sentence demands ONE document containing all those words and usually returns nothing. Query like a specialist drafting a Boolean search — terms of art, the controlled vocabulary drafters and courts actually use: "nonjudicial foreclosure", "holder in due course", "material alteration", "deliberate indifference". A tax question is "gross income discharge indebtedness", not "when do I owe taxes on cancelled debt". Think about the exact words that physically appear IN the statute.
- If a query returns 0, you over-constrained: drop the weakest word, or move the variable term into a search_boolean 'any' OR-group ("void"/"voidable", "assignment"/"transfer"/"conveyance", "endorsement"/"indorsement") rather than re-running one verbose phrase.
- PROVEN PATTERNS (what actually hits this index): (1) Pair the statute's OWN defined terms — "discharge indebtedness", "qualified mortgage", "residual interest", "identifiable event" land their exact regulation; the pair disambiguates better than either word alone. (2) Use the jurisdiction's local noun — Nebraska says "trust deed", not "deed of trust"; match the term the legislature used. (3) AVOID acronyms and conceptual labels — "COD", "REMIC" alone, "phantom income" return nothing; the index knows only the spelled-out terms of art ("cancellation of indebtedness", "real estate mortgage investment conduit").
- search_cases: ALWAYS pass jurisdiction when you can. Unscoped case searches pull unrelated SCOTUS noise over on-point state cases. Scope to the user's state, or "scotus", and only widen if scoped comes up short.
- When a search by identifier would be exact (you know the cite, e.g. "usc/title-15/section-1692a"), fetch_document directly instead of searching for it.
- THE UNTAPPED VEINS: register (Federal Register) and bill (congressional bills) carry the actual agency + congressional reasoning behind the law — the richest, least-cited "right from the horse's mouth" material. When PURPOSE or intent is in play, mine them via legislative_history / regulatory_history, or search source "register"/"bill" directly.

LEGAL REASONING METHOD:
When reading any statute, regulation, or case, apply three components in order:
1. LANGUAGE — what does the text actually say? Identify ordinary meaning, defined terms, and the semantic range. Note ambiguity or vagueness explicitly.
2. PURPOSE — why does this provision exist? What mischief does it address? What would a reasonable legislator have intended? Legislative history and the statute's structure are evidence.
3. NORMATIVE CONTEXT — how does this sit within the broader legal system? What higher authority constrains interpretation? What does existing case law say? Does it conflict with constitutional protections?

RESEARCH SEQUENCE: Start with the controlling statute or constitutional provision. Then find cases that interpret that specific text. Then find adverse applications — cases where a court ruled the provision did NOT cover the user's situation. The research is not complete until you have checked both sides.

IRAC FOR PROPOSALS: Every why_it_matters should answer: What is the precise legal issue? What does this authority say the rule is? How does that rule apply to the user's specific facts? What is the conclusion — does it help or hurt?`;


// Constrained drafting mode (#5): the case board is the ONLY source of truth.
const DRAFT_SYSTEM = `You are drafting a section of the user's legal document in CONSTRAINED MODE. The user's CASE BOARD (below) is your ONLY source of authority.

ABSOLUTE RULES — non-negotiable:
- Every legal or factual assertion MUST trace to an authority already pinned on the case board. Cite it inline by its citation (e.g. "42 U.S.C. § 1983").
- You may NOT introduce any case, statute, regulation, or rule that is not on the board. NO citations from memory. NO improvising. If you "know" a great case that isn't pinned, you may not use it — say so as a gap instead.
- When the argument needs a proposition the board does not support, do NOT fill it from training data. Insert a visible placeholder exactly like: [GAP: need authority for <the missing proposition>]. Gaps are the whole point — they show the user what research is left. Never paper over a hole.
- Use the supporting authorities to build the argument; use the adverse authorities to pre-empt the other side (address and distinguish them). Weave in the user's pinned quotes verbatim where they fit.
- Write plain, direct legal prose in the user's voice (first person where natural). Follow IRAC where it fits the section.
- Output the draft text only — no preamble, no "here's a draft," no meta-commentary about what you did.
- Close with: "_This is general legal information, not legal advice. Consult a licensed attorney for your specific situation._"`;

// Serialize the case board into a compact block appended to the system prompt.
// Gives the model working memory of the case so it builds on what's there instead
// of starting cold or re-proposing already-pinned authorities.
type BoardRow = {
  kind: string;
  stance: string | null;
  citation: string | null;
  identifier: string | null;
  heading: string | null;
  pin_cite: string | null;
  quote: string | null;
  user_note: string | null;
};
function buildBoardContext(rows: BoardRow[]): string {
  if (rows.length === 0) {
    return `\n\nCASE BOARD: empty. The user has not pinned any authorities or logged questions yet. A good opening move is a parallel sweep (statutes + cases) and a draft set of proposals.`;
  }
  const support = rows.filter((r) => r.kind === "authority" && r.stance !== "adverse");
  const adverse = rows.filter((r) => r.kind === "authority" && r.stance === "adverse");
  const questions = rows.filter((r) => r.kind === "question");
  const notes = rows.filter((r) => r.kind === "note");
  const fmtAuthority = (r: BoardRow) => {
    const cite = [r.citation || r.identifier, r.pin_cite].filter(Boolean).join(" ");
    const q = r.quote ? ` — "${r.quote.slice(0, 200)}${r.quote.length > 200 ? "…" : ""}"` : "";
    return `  • ${cite}${r.heading ? ` (${r.heading})` : ""}${q}`;
  };
  const lines: string[] = [
    `\n\nCASE BOARD (the user's working case — already on the board, do NOT re-propose these):`,
  ];
  if (support.length) lines.push(`SUPPORTING AUTHORITIES (${support.length}):`, ...support.map(fmtAuthority));
  if (adverse.length) lines.push(`ADVERSE AUTHORITIES (${adverse.length}):`, ...adverse.map(fmtAuthority));
  if (questions.length) lines.push(`OPEN QUESTIONS (${questions.length}):`, ...questions.map((r) => `  • ${r.user_note ?? ""}`));
  if (notes.length) lines.push(`NOTES (${notes.length}):`, ...notes.map((r) => `  • ${r.user_note ?? ""}`));
  lines.push(`Build on this. Fill gaps, find adverse authority for the supporting pins, and answer the open questions — don't repeat what's already here.`);
  return lines.join("\n");
}

// Fetch the document the user is currently reading (statute by identifier, or an
// opinion by a search id) and render it as a focus block for the system prompt.
async function buildFocusContext(
  corpus: ReturnType<typeof corpusClient>,
  ref: string | null,
): Promise<string> {
  if (!ref) return "";
  const db = corpus as unknown as { from: (t: string) => any };
  let citation = "", heading = "", court: string | null = null, bodyText = "";
  try {
    if (ref.startsWith("scotus:")) {
      const { data } = await db.from("opinion_record").select("case_title,us_cite,body_text").eq("slug", ref.slice(7)).maybeSingle();
      if (!data) return "";
      citation = data.us_cite ?? data.case_title; heading = data.case_title; court = "U.S. Supreme Court"; bodyText = data.body_text ?? "";
    } else if (ref.startsWith("state:")) {
      const { data } = await db.from("state_supreme_opinions").select("title,citation,state,issuer,body_text").eq("id", ref.slice(6)).maybeSingle();
      if (!data) return "";
      citation = data.citation ?? data.title; heading = data.title; court = data.issuer ?? `${data.state} Supreme Court`; bodyText = data.body_text ?? "";
    } else {
      const { data } = await db.from("documents").select("identifier,section_label,heading,body_text").eq("identifier", ref).maybeSingle();
      if (!data) return "";
      citation = data.section_label ?? data.identifier; heading = data.heading ?? ""; bodyText = data.body_text ?? "";
    }
  } catch {
    return "";
  }
  const trimmed = bodyText.slice(0, 9000);
  return `\n\nCURRENTLY VIEWING (the user has this open in their reader right now — comment on THIS, flag the operative language and any exceptions, and don't make them paste it):\n${[court, citation, heading].filter(Boolean).join(" · ")}\n"""\n${trimmed}${bodyText.length > 9000 ? "\n…[truncated]" : ""}\n"""`;
}

// The user's live draft from the Doc Creator editor, rendered as a block so the
// model can see what's actually on the page — what's written, what's stubbed, and
// where it trails off — instead of being blind to the document it's helping build.
function buildDraftContext(title: string | null, body: string | null): string {
  const text = (body ?? "").trim();
  if (!text) {
    return `\n\nCURRENT DRAFT: empty. The user hasn't written anything in the Doc Creator yet.`;
  }
  const LIMIT = 8000;
  const trimmed = text.length > LIMIT ? text.slice(-LIMIT) : text;
  const head = text.length > LIMIT ? "…[earlier draft truncated]\n" : "";
  return `\n\nCURRENT DRAFT (what the user has written so far in the Doc Creator — this is the live document on their screen; when they ask about "the draft", "my document", "this section", or "what I wrote", they mean THIS):\nTitle: ${title?.trim() || "Untitled draft"}\n"""\n${head}${trimmed}\n"""`;
}

async function authenticate(request: Request): Promise<{ userId: string; token: string } | Response> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const token = auth.slice(7).trim();
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response("Server misconfigured", { status: 500 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return new Response("Unauthorized", { status: 401 });
  return { userId: data.user.id, token };
}

// Workspace tables (threads, messages, case_items) live in the cloud auth project.
function cloudClient(token: string) {
  const url = process.env.SUPABASE_AUTH_URL!;
  const key = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Corpus data (documents, FTS search) lives in the local self-hosted backend.
function corpusClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const Route = createFileRoute("/api/workspace/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { userId, token } = auth;

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string; focusedRef?: string | null; mode?: "research" | "draft"; draftTitle?: string | null; draftText?: string | null };
        if (!Array.isArray(body.messages) || !body.threadId) {
          return new Response("messages and threadId required", { status: 400 });
        }
        const threadId = body.threadId;
        const workspace = cloudClient(token);
        const corpus = corpusClient();

        // Verify thread ownership
        const { data: thread } = await workspace
          .from("workspace_threads")
          .select("id,user_id,title")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread || thread.user_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        // Working memory: the user's case board, serialized into the system prompt so
        // the model knows what's already established/contested/parked and doesn't
        // re-propose things the user already pinned or asked.
        const { data: boardRows } = await workspace
          .from("workspace_case_items")
          .select("kind,stance,citation,identifier,heading,pin_cite,quote,user_note")
          .eq("thread_id", threadId)
          .order("kind", { ascending: true })
          .order("order_index", { ascending: true });
        // Shared focus: if the user has a document open in the reader, fetch its
        // text and append it so the model is looking at exactly what they are.
        const focusContext = await buildFocusContext(corpus, body.focusedRef ?? null);
        // Constrained drafting (#5) swaps the base prompt and drops the research
        // tools, so the board is the only source the model can draw from.
        const draftMode = body.mode === "draft";
        // The model should always be able to see the user's live draft — to revise
        // it, spot gaps before filing, or write the next section in context.
        const draftContext = buildDraftContext(body.draftTitle ?? null, body.draftText ?? null);
        const systemPrompt = (draftMode ? DRAFT_SYSTEM : SYSTEM) + buildBoardContext(boardRows ?? []) + draftContext + focusContext;

        const model = anthropic("claude-sonnet-4-6");

        const tools = {
          search_corpus: tool({
            description:
              "READ-ONLY: Full-text search of statutes, regulations, the Constitution, and bills (3.9M sections). " +
              "Sources: federal (\"usc\", \"cfr\", \"const\", \"ucc\", \"register\", \"irm\", \"tfm\", \"bill\") and all 50 states (two-letter codes like \"ca\", \"ny\", \"tx\"). " +
              "Pass `source` to scope to one code; omit it to search the entire corpus. For case law, use search_cases instead. " +
              "QUERY WITH 2-4 KEYWORDS / TERMS OF ART, not sentences — every word is AND-ed, so each extra word narrows the result and long phrases return nothing. Use the controlled vocabulary that appears IN the statute (e.g. 'material alteration negotiable instrument'). If you get 0 hits, drop a word or try a synonym.",
            inputSchema: z.object({
              q: z.string().min(2).describe("2-4 keywords / terms of art (AND-ed). e.g. 'nonjudicial foreclosure deed of trust' — NOT a natural-language sentence."),
              source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().describe("Optional source code to scope to (e.g. 'usc', 'ca'). Omit to search everything."),
              limit: z.number().int().min(1).max(20).default(8),
            }),
            execute: async ({ q, source, limit }) => {
              const { data, error } = await corpus.rpc("search_documents_fts", {
                p_query: q,
                p_source: source ?? null,
                p_limit: limit,
              });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { identifier: string; source_code: string; section_label: string | null; heading: string | null; snippet: string }) => ({
                  identifier: r.identifier,
                  source: r.source_code,
                  citation: r.section_label ?? r.identifier,
                  heading: r.heading,
                  snippet: r.snippet?.replace(/<\/?mark>/g, "") ?? "",
                  url: `/code/${r.identifier}`,
                })),
              };
            },
          }),
          scan_corpus: tool({
            description:
              "READ-ONLY: HIGH-VOLUME LEAN SCAN — your primary search. Pulls up to 300 matching sections as lean citation rows (identifier + citation, NO bodies/snippets) across the 4M-section corpus. " +
              "It does NOT read the documents, it grabs the hits — so cast WIDE: set a high limit and pull the whole field at once. The full result list is also shown to the USER in their browser as a clickable list, so a broad scan hands them the landscape, not just you. " +
              "Boolean operators work inline in q: space = AND, 'OR' = OR, \"quoted\" = exact phrase, leading - = exclude. e.g. 'nonjudicial foreclosure OR \"power of sale\" -judicial'. Omit source to sweep all federal+state sources; scope with a source code to focus. Reason over the returned list; fetch full text only for the few cites you'll quote.",
            inputSchema: z.object({
              q: z.string().min(2).describe("Terms of art with inline boolean ops: space=AND, OR, \"phrase\", -exclude. e.g. 'deed of trust OR \"trust deed\" foreclosure'."),
              source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().describe("Optional source code to scope to. Omit to scan everything."),
              limit: z.number().int().min(1).max(300).default(80).describe("How many hits to pull. Go high (100-300) to grab the whole field — they're lean."),
            }),
            execute: async ({ q, source, limit }) => {
              const { data, error } = await corpus.rpc("scan_documents", { p_query: q, p_source: source ?? null, p_limit: limit });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { identifier: string; source_code: string; section_label: string | null; heading: string | null }) => ({
                  id: r.identifier,
                  cite: r.section_label || r.heading || r.identifier,
                  heading: r.section_label && r.heading && r.heading !== r.section_label ? r.heading : null,
                  source: r.source_code,
                })),
              };
            },
          }),
          citations: tool({
            description:
              "READ-ONLY: Follow the CITATION GRAPH one hop, cheaply. Given a section's identifier, returns the authorities it cites (direction 'out') or the sections that cite it (direction 'in') as lean rows — WITHOUT reading any full text. " +
              "A section can cite dozens of others; this is how you walk the graph several steps out and fetch full text only at the leaves. 'out' = what this section relies on; 'in' = who relies on this one (how load-bearing it is). Rows with a null id aren't in the corpus — search the cite text to chase them.",
            inputSchema: z.object({
              identifier: z.string().describe("A section identifier exactly as returned by another tool (e.g. '/usc/title-42/section-1983')."),
              direction: z.enum(["out", "in"]).default("out").describe("'out' = authorities this cites; 'in' = sections that cite this."),
              limit: z.number().int().min(1).max(80).default(40),
            }),
            execute: async ({ identifier, direction, limit }) => {
              const { data, error } = await corpus.rpc("document_citations", { p_identifier: identifier, p_direction: direction, p_limit: limit });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { cite: string; identifier: string | null; target_type: string | null }) => ({
                  cite: r.cite,
                  id: r.identifier ?? null,
                  type: r.target_type,
                })),
              };
            },
          }),
          list_basins: tool({
            description:
              "READ-ONLY: PRECOMPUTED BASINS — cached boolean trigger-expressions, mined offline. Each basin is an AND of legal trigger words " +
              "(e.g. 'debt & collector & instrument|note', 'taxation & void & discharge & fraud') whose matching sections were computed ahead of time. " +
              "Pass ONE trigger word to find the basins that include it (most-matched first); omit to list the largest basins. " +
              "Use this to AIM: when the matter maps onto common trigger combinations, find the basin then open_basin to pull its whole field instantly — no live sweep of 3.4M. Different basins surface different fields; scan the labels for an angle you hadn't queried.",
            inputSchema: z.object({
              term: z.string().min(2).optional().describe("A single trigger word to find basins containing it, e.g. 'discharge'. Omit to list the largest basins."),
              limit: z.number().int().min(1).max(200).default(60),
            }),
            execute: async ({ term, limit }) => {
              const { data, error } = await corpus.rpc("basin_list", { p_term: term ?? null, p_limit: limit });
              if (error) return { error: error.message, basins: [] };
              return {
                count: data?.length ?? 0,
                basins: (data ?? []).map((r: { id: number; label: string; doc_count: number }) => ({
                  id: r.id, label: r.label, docs: r.doc_count,
                })),
              };
            },
          }),
          open_basin: tool({
            description:
              "READ-ONLY: Open a precomputed basin by id (from list_basins) — returns its cached section hits as lean citation rows (no bodies). " +
              "This is a KEYED READ of a precomputed set, not a live scan, so it's near-free and instant. The whole field is also rendered to the user's browser as a clickable list. Scope with a source code to focus the cached set.",
            inputSchema: z.object({
              basin_id: z.number().int().describe("A basin id from list_basins."),
              source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().describe("Optional source code to scope the cached set."),
              limit: z.number().int().min(1).max(500).default(200),
            }),
            execute: async ({ basin_id, source, limit }) => {
              const { data, error } = await corpus.rpc("basin_docs", { p_basin_id: basin_id, p_source: source ?? null, p_limit: limit });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { identifier: string; source_code: string; section_label: string | null; heading: string | null }) => ({
                  id: r.identifier,
                  cite: r.section_label || r.heading || r.identifier,
                  heading: r.section_label && r.heading && r.heading !== r.section_label ? r.heading : null,
                  source: r.source_code,
                })),
              };
            },
          }),
          precise_search: tool({
            description:
              "READ-ONLY: PRECISION DRILL — pin the ONE on-point section by AND-ing several DIVERSE terms that never sit next to each other but all live in that document " +
              "(e.g. ['foreclosure','election','remedies','extinguish','collection'] → a single Treasury reg). Which terms fit varies per matter — pick the ones that describe THIS case. " +
              "CHEAP TO PROBE: if the combo is still too broad it returns ONLY a count (broad:true) and transfers NO rows — so add another distinguishing term and call again; if it returns 0, drop the term that doesn't belong; when it narrows to <= max hits you get those exact citations. This is how you cut wasteful searches: deepen for almost nothing, pull only when surgical.",
            inputSchema: z.object({
              terms: z.array(z.string().min(2)).min(2).max(10).describe("Diverse case-relevant terms to AND — words that co-occur in the target document though not adjacent. Add more to narrow, remove to broaden."),
              source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().describe("Optional source code to scope to."),
              max: z.number().int().min(1).max(100).default(12).describe("Return rows only at/below this many hits; above it you get just the count (broad:true)."),
            }),
            execute: async ({ terms, source, max }) => {
              const { data, error } = await corpus.rpc("precise_match", { p_terms: terms, p_source: source ?? null, p_max: max });
              if (error) return { error: error.message, results: [] };
              const d = (data ?? {}) as { count?: number; broad?: boolean; results?: Array<{ id: string; cite: string; heading: string | null; source: string }> };
              return { count: d.count ?? 0, broad: d.broad ?? false, results: d.results ?? [] };
            },
          }),
          search_boolean: tool({
            description:
              "READ-ONLY: Precision search with EXPLICIT logic gates over the same 3.9M-section corpus as search_corpus. " +
              "Use this when a plain keyword AND isn't enough — when you need an OR group (synonyms / spelling variants), an exact phrase, or to EXCLUDE a sense of a word. " +
              "Gates: `all` = every term must appear (AND); `any` = at least one must appear (one OR group, AND-ed against the rest); `phrase` = exact ordered phrase; `exclude` = drop any document containing these. " +
              "Example: all=['foreclosure'], any=['indorsement','endorsement'], phrase='holder in due course', exclude=['judicial'] — finds nonjudicial-foreclosure HDC sections regardless of spelling. Combine with `source` to scope.",
            inputSchema: z.object({
              all: z.array(z.string()).default([]).describe("Every term AND-ed in (each must appear). Terms of art, not sentences."),
              any: z.array(z.string()).default([]).describe("OR group — at least one must appear. Use for synonyms / spelling variants ('indorsement','endorsement')."),
              phrase: z.string().optional().describe("Exact ordered phrase, e.g. 'holder in due course'."),
              exclude: z.array(z.string()).default([]).describe("Exclude documents containing any of these terms (NOT)."),
              source: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/).optional().describe("Optional source code to scope to (e.g. 'usc', 'ca')."),
              limit: z.number().int().min(1).max(20).default(8),
            }),
            execute: async ({ all, any, phrase, exclude, source, limit }) => {
              if (!all.length && !any.length && !phrase) {
                return { error: "Give at least one of: all, any, or phrase.", results: [] };
              }
              const { data, error } = await corpus.rpc("search_documents_bool", {
                p_all: all,
                p_any: any,
                p_phrase: phrase ?? null,
                p_not: exclude,
                p_source: source ?? null,
                p_limit: limit,
              });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { identifier: string; source_code: string; section_label: string | null; heading: string | null; snippet: string }) => ({
                  identifier: r.identifier,
                  source: r.source_code,
                  citation: r.section_label ?? r.identifier,
                  heading: r.heading,
                  snippet: r.snippet?.replace(/<\/?mark>/g, "") ?? "",
                  url: `/code/${r.identifier}`,
                })),
              };
            },
          }),
          legislative_history: tool({
            description:
              "READ-ONLY: From a U.S. Code title + section, the congressional bills that amended (or proposed to amend) it — enacted bills first, then attempts, newest Congress first. " +
              "A bill's findings + purpose + section-by-section are CONGRESS'S OWN STATED REASONING for the statutory text — the horse's mouth for legislative intent and PURPOSE-prong analysis. " +
              "Call this whenever you are citing or interpreting a USC section and want the intent behind it. Section is the bare number as it appears in the cite (e.g. title 42, section '1983').",
            inputSchema: z.object({
              title: z.number().int().min(1).max(54).describe("USC title number, e.g. 42"),
              section: z.string().min(1).max(20).describe("USC section number as written, e.g. '1983' or '552a'"),
              limit: z.number().int().min(1).max(40).default(15),
            }),
            execute: async ({ title, section, limit }) => {
              const { data, error } = await corpus.rpc("usc_bill_history", { p_title: title, p_section: section, p_limit: limit });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { latest_id: string; title: string | null; short_title: string | null; congress: number | null; latest_stage: string | null; enacted: boolean | null }) => ({
                  identifier: r.latest_id,
                  citation: r.short_title || r.title || r.latest_id,
                  congress: r.congress,
                  enacted: r.enacted,
                  stage: r.latest_stage,
                  url: `/code/${r.latest_id}`,
                })),
              };
            },
          }),
          regulatory_history: tool({
            description:
              "READ-ONLY: From a CFR title + part, the Federal Register rulemakings that created or amended that part — newest first. " +
              "An FR preamble + SUPPLEMENTARY INFORMATION is the AGENCY'S OWN STATED REASONING for the regulation (problem addressed, comments answered, authority claimed) — the horse's mouth for a reg's purpose. " +
              "Call this whenever you cite or interpret a CFR section. The CFR *part* is the integer before the dot in the section number (40 CFR 52.21 is part 52).",
            inputSchema: z.object({
              title: z.number().int().min(1).max(50).describe("CFR title number, e.g. 40"),
              part: z.number().int().min(1).describe("CFR part number (integer before the dot in the section, e.g. 52)"),
              limit: z.number().int().min(1).max(40).default(15),
            }),
            execute: async ({ title, part, limit }) => {
              const { data, error } = await corpus.rpc("cfr_register_history", { p_title: title, p_part: part, p_limit: limit });
              if (error) return { error: error.message, results: [] };
              return {
                count: data?.length ?? 0,
                results: (data ?? []).map((r: { identifier: string; fr_doc_number: string; title: string | null; doc_type: string | null; decided: string | null }) => ({
                  identifier: r.identifier,
                  citation: r.title || `FR Doc. ${r.fr_doc_number}`,
                  doc_type: r.doc_type,
                  decided: r.decided,
                  url: `/code/${r.identifier}`,
                })),
              };
            },
          }),
          fetch_document: tool({
            description: "READ-ONLY: Fetch the full text of one document by identifier (e.g. 'usc/42/1983').",
            inputSchema: z.object({ identifier: z.string() }),
            execute: async ({ identifier }) => {
              const { data, error } = await corpus
                .from("documents")
                .select("identifier,source_code,section_label,heading,body_text")
                .eq("identifier", identifier)
                .maybeSingle();
              if (error || !data) return { error: error?.message ?? "Not found" };
              const body = (data.body_text ?? "").slice(0, 8000);
              return {
                identifier: data.identifier,
                citation: data.section_label ?? data.identifier,
                heading: data.heading,
                body,
                url: `/code/${data.identifier}`,
              };
            },
          }),
          search_cases: tool({
            description:
              "READ-ONLY: Search U.S. court opinions by full text. Covers the Supreme Court (28k opinions) and state supreme courts (528k, all 50 states). " +
              "Use this to find how courts have actually applied a statute, the elements of a common-law claim, or adverse holdings. " +
              "Scope with `jurisdiction`: 'scotus', 'state', or a state name (e.g. 'california'); omit to search both.",
            inputSchema: z.object({
              q: z.string().min(2).describe("Search query — operative phrase or doctrine, e.g. 'deliberate indifference'"),
              jurisdiction: z.string().optional().describe("'scotus', 'state', or a state name. Omit to search both."),
              limit: z.number().int().min(1).max(15).default(8),
            }),
            execute: async ({ q, jurisdiction, limit }) => {
              const j = (jurisdiction ?? "").trim().toLowerCase();
              const wantScotus = j === "" || j === "scotus" || j === "us" || j === "supreme";
              const wantState = j === "" || j === "state" || (!wantScotus);
              const results: Array<Record<string, unknown>> = [];
              // SCOTUS — title index, ranked by how often the opinion is cited.
              if (wantScotus) {
                const { data } = await corpus
                  .from("opinion_record")
                  .select("slug,case_title,us_cite,year,cited_count")
                  .textSearch("body_tsv", q, { type: "websearch", config: "english" })
                  .order("cited_count", { ascending: false })
                  .limit(limit);
                for (const r of (data ?? []) as Array<{ slug: string; case_title: string; us_cite: string | null; year: number | null; cited_count: number }>) {
                  results.push({
                    id: `scotus:${r.slug}`,
                    court: "U.S. Supreme Court",
                    title: r.case_title,
                    citation: r.us_cite ?? "",
                    year: r.year,
                    cited_count: r.cited_count,
                    url: `/record/${r.slug}`,
                  });
                }
              }
              // State supreme courts — full body index. Filter to a state name if given.
              if (wantState) {
                let query = corpus
                  .from("state_supreme_opinions")
                  .select("id,title,citation,state,issuer,decided_at")
                  .textSearch("body_tsv", q, { type: "websearch", config: "english" });
                const stateName = j && !["state", "scotus", "us", "supreme", ""].includes(j) ? j : null;
                if (stateName) query = query.eq("state", stateName);
                const { data } = await query.limit(limit);
                for (const r of (data ?? []) as Array<{ id: string; title: string; citation: string | null; state: string; issuer: string | null; decided_at: string | null }>) {
                  results.push({
                    id: `state:${r.id}`,
                    court: r.issuer ?? `${r.state} Supreme Court`,
                    state: r.state,
                    title: r.title,
                    citation: r.citation ?? "",
                    year: r.decided_at ? new Date(r.decided_at).getFullYear() : null,
                  });
                }
              }
              return { count: results.length, results };
            },
          }),
          fetch_case: tool({
            description: "READ-ONLY: Fetch the full text of one court opinion by the `id` returned from search_cases (e.g. 'scotus:miranda-v-arizona' or 'state:<uuid>').",
            inputSchema: z.object({ id: z.string() }),
            execute: async ({ id }) => {
              if (id.startsWith("scotus:")) {
                const slug = id.slice("scotus:".length);
                const { data, error } = await corpus
                  .from("opinion_record")
                  .select("slug,case_title,us_cite,year,body_text")
                  .eq("slug", slug)
                  .maybeSingle();
                if (error || !data) return { error: error?.message ?? "Not found" };
                return {
                  id,
                  court: "U.S. Supreme Court",
                  title: data.case_title,
                  citation: data.us_cite ?? "",
                  year: data.year,
                  body: (data.body_text ?? "").slice(0, 12000),
                  url: `/record/${data.slug}`,
                };
              }
              if (id.startsWith("state:")) {
                const sid = id.slice("state:".length);
                const { data, error } = await corpus
                  .from("state_supreme_opinions")
                  .select("id,title,citation,state,issuer,decided_at,body_text")
                  .eq("id", sid)
                  .maybeSingle();
                if (error || !data) return { error: error?.message ?? "Not found" };
                return {
                  id,
                  court: data.issuer ?? `${data.state} Supreme Court`,
                  title: data.title,
                  citation: data.citation ?? "",
                  year: data.decided_at ? new Date(data.decided_at).getFullYear() : null,
                  body: (data.body_text ?? "").slice(0, 12000),
                };
              }
              return { error: "id must start with 'scotus:' or 'state:'" };
            },
          }),
          propose_search: tool({
            description: "Suggest a search the user might want to run. Renders as a chip with Run / Edit / Dismiss. Use when you don't have enough to answer or when the user would benefit from exploring a specific query themselves.",
            inputSchema: z.object({
              query: z.string().min(2).max(200),
              source: z.enum(["usc", "cfr", "ucc", "const", "register"]).optional(),
              why: z.string().max(600).describe("Why this search helps the user's case, in one sentence."),
            }),
            execute: async (args) => ({ proposal: "search", ...args }),
          }),
          propose_pin: tool({
            description: "Suggest the user pin a supporting authority to their case board. The user will review, edit the quote/pin-cite, and decide whether to keep it.",
            inputSchema: z.object({
              identifier: z.string().describe("e.g. 'usc/42/1983'"),
              citation: z.string().describe("e.g. '42 U.S.C. § 1983'"),
              heading: z.string().optional(),
              suggested_quote: z.string().max(4000).describe("Verbatim operative language from the section."),
              suggested_pin_cite: z.string().max(120).optional().describe("e.g. '(a)(2)'"),
              why_it_matters: z.string().max(2000).describe("One tight IRAC paragraph: issue, rule, application, conclusion."),
            }),
            execute: async (args) => ({ proposal: "pin", stance: "support", ...args }),
          }),
          propose_adverse: tool({
            description: "Flag a statute/regulation that cuts AGAINST the user's position. Same shape as propose_pin but pre-tagged adverse.",
            inputSchema: z.object({
              identifier: z.string(),
              citation: z.string(),
              heading: z.string().optional(),
              suggested_quote: z.string().max(4000),
              suggested_pin_cite: z.string().max(120).optional(),
              why_it_cuts_against: z.string().max(2000).describe("Danger rating + why, one tight paragraph."),
            }),
            execute: async (args) => ({
              proposal: "pin",
              stance: "adverse",
              ...args,
              why_it_matters: args.why_it_cuts_against,
            }),
          }),
          propose_question: tool({
            description: "Add an open research question to the user's case board for them (or you) to investigate later.",
            inputSchema: z.object({
              text: z.string().min(5).max(600),
              why: z.string().max(600).optional(),
            }),
            execute: async (args) => ({ proposal: "question", ...args }),
          }),
        };

        const result = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(body.messages),
          tools: draftMode ? {} : tools,
          stopWhen: stepCountIs(draftMode ? 3 : 50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            try {
              // Replace stored messages with the new full transcript (simpler than diffing).
              await workspace.from("workspace_messages").delete().eq("thread_id", threadId);
              const rows = messages.map((m) => ({
                thread_id: threadId,
                user_id: userId,
                role: m.role,
                parts: m.parts,
              }));
              if (rows.length > 0) {
                await workspace.from("workspace_messages").insert(rows);
              }
              // Auto-title from first user message if still default
              if (thread.title === "New session" || thread.title === "Continued from chat") {
                const firstUser = messages.find((m) => m.role === "user");
                const text = firstUser?.parts
                  ?.map((p: { type: string; text?: string }) => (p.type === "text" ? p.text ?? "" : ""))
                  .join(" ")
                  .trim();
                if (text) {
                  await workspace
                    .from("workspace_threads")
                    .update({ title: text.slice(0, 80), last_message_at: new Date().toISOString() })
                    .eq("id", threadId);
                }
              } else {
                await workspace
                  .from("workspace_threads")
                  .update({ last_message_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            } catch (e) {
              console.error("[workspace/chat] persist failed:", e);
            }
          },
        });
      },
    },
  },
});