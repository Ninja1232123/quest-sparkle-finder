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

THE CORPUS YOU CAN SEARCH (all read-only, all on the self_law backend):
- STATUTES & REGULATIONS via search_corpus — 3.9M sections across: federal (source codes "usc", "cfr", "const", "ucc", "register", "irm", "tfm", and "bill" for 835k congressional bills) AND all 50 states (two-letter codes: "ak", "al", "az", "ca", "ny", "tx", … through "wy"). Pass source to scope to one code, or omit source to search everything at once.
- CASE LAW via search_cases — U.S. Supreme Court opinions (full text, 28k) and state supreme court opinions (full text, 528k, all 50 states). Use jurisdiction to scope: "scotus", "state", or a state name; omit it to search both.
- FULL TEXT via fetch_document (a statute/reg section by identifier) and fetch_case (a full opinion by id from a search_cases result).

SEARCH LIKE A LAWYER — USE EVERYTHING:
- Fire multiple searches in parallel in a single turn. A real research sweep hits statutes AND cases AND adverse authority at once — don't drip one query at a time.
- Don't stay in one source. If the user has a federal claim with a state-law component, search both. If a statute governs, also search_cases for opinions that interpret it. Statutes are the skeleton; cases are how courts actually apply them.
- Tight queries beat broad ones. Quote the operative phrase ("qualified immunity", "deliberate indifference") rather than full sentences. If a query is noisy, narrow the source/jurisdiction rather than fetching everything.
- When you cite a controlling statute, look for the cases interpreting it — then look for the adverse cases where a court found it did NOT apply. Research is not complete until both sides are checked.

LEGAL REASONING METHOD:
When reading any statute, regulation, or case, apply three components in order:
1. LANGUAGE — what does the text actually say? Identify ordinary meaning, defined terms, and the semantic range. Note ambiguity or vagueness explicitly.
2. PURPOSE — why does this provision exist? What mischief does it address? What would a reasonable legislator have intended? Legislative history and the statute's structure are evidence.
3. NORMATIVE CONTEXT — how does this sit within the broader legal system? What higher authority constrains interpretation? What does existing case law say? Does it conflict with constitutional protections?

RESEARCH SEQUENCE: Start with the controlling statute or constitutional provision. Then find cases that interpret that specific text. Then find adverse applications — cases where a court ruled the provision did NOT cover the user's situation. The research is not complete until you have checked both sides.

IRAC FOR PROPOSALS: Every why_it_matters should answer: What is the precise legal issue? What does this authority say the rule is? How does that rule apply to the user's specific facts? What is the conclusion — does it help or hurt?`;


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

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string; focusedRef?: string | null };
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
        const systemPrompt = SYSTEM + buildBoardContext(boardRows ?? []) + focusContext;

        const model = anthropic("claude-sonnet-4-6");

        const tools = {
          search_corpus: tool({
            description:
              "READ-ONLY: Full-text search of statutes, regulations, the Constitution, and bills (3.9M sections). " +
              "Sources: federal (\"usc\", \"cfr\", \"const\", \"ucc\", \"register\", \"irm\", \"tfm\", \"bill\") and all 50 states (two-letter codes like \"ca\", \"ny\", \"tx\"). " +
              "Pass `source` to scope to one code; omit it to search the entire corpus. For case law, use search_cases instead.",
            inputSchema: z.object({
              q: z.string().min(2).describe("Search query — quote the operative phrase, e.g. 'qualified immunity'"),
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
              why: z.string().max(280).describe("Why this search helps the user's case, in one sentence."),
            }),
            execute: async (args) => ({ proposal: "search", ...args }),
          }),
          propose_pin: tool({
            description: "Suggest the user pin a supporting authority to their case board. The user will review, edit the quote/pin-cite, and decide whether to keep it.",
            inputSchema: z.object({
              identifier: z.string().describe("e.g. 'usc/42/1983'"),
              citation: z.string().describe("e.g. '42 U.S.C. § 1983'"),
              heading: z.string().optional(),
              suggested_quote: z.string().max(1500).describe("Verbatim operative language from the section."),
              suggested_pin_cite: z.string().max(120).optional().describe("e.g. '(a)(2)'"),
              why_it_matters: z.string().max(400),
            }),
            execute: async (args) => ({ proposal: "pin", stance: "support", ...args }),
          }),
          propose_adverse: tool({
            description: "Flag a statute/regulation that cuts AGAINST the user's position. Same shape as propose_pin but pre-tagged adverse.",
            inputSchema: z.object({
              identifier: z.string(),
              citation: z.string(),
              heading: z.string().optional(),
              suggested_quote: z.string().max(1500),
              suggested_pin_cite: z.string().max(120).optional(),
              why_it_cuts_against: z.string().max(400),
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
              text: z.string().min(5).max(400),
              why: z.string().max(280).optional(),
            }),
            execute: async (args) => ({ proposal: "question", ...args }),
          }),
        };

        const result = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(50),
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