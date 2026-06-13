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
- Use search_corpus and fetch_document freely as your own research; they are read-only. Ground every proposal in real results — never invent citations.
- For propose_pin / propose_adverse, ALWAYS include the operative quote verbatim (no paraphrasing). The why_it_matters must follow IRAC: state the Issue it addresses, the Rule (what the authority says), and the Application (how it connects to the user's specific facts). One tight paragraph.
- Use propose_adverse when you find authority that cuts AGAINST the user's position. Rate its danger: CRITICAL (defeats the claim on its face), HIGH (requires rebuttal argument), MEDIUM (distinguishable but needs addressing), LOW (background noise). Put the rating in why_it_matters.
- For open issues the user hasn't researched yet, emit propose_question. Don't try to answer everything in one turn.
- Reply text should be short and direct. Heavy lifting goes into the proposal cards. Do not dump long summaries the user didn't ask for.
- End substantive legal answers with: "_This is general legal information, not legal advice. Consult a licensed attorney for your specific situation._"

LEGAL REASONING METHOD:
When reading any statute, regulation, or case, apply three components in order:
1. LANGUAGE — what does the text actually say? Identify ordinary meaning, defined terms, and the semantic range. Note ambiguity or vagueness explicitly.
2. PURPOSE — why does this provision exist? What mischief does it address? What would a reasonable legislator have intended? Legislative history and the statute's structure are evidence.
3. NORMATIVE CONTEXT — how does this sit within the broader legal system? What higher authority constrains interpretation? What does existing case law say? Does it conflict with constitutional protections?

RESEARCH SEQUENCE: Start with the controlling statute or constitutional provision. Then find cases that interpret that specific text. Then find adverse applications — cases where a court ruled the provision did NOT cover the user's situation. The research is not complete until you have checked both sides.

IRAC FOR PROPOSALS: Every why_it_matters should answer: What is the precise legal issue? What does this authority say the rule is? How does that rule apply to the user's specific facts? What is the conclusion — does it help or hurt?`;


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

        const body = (await request.json()) as { messages?: UIMessage[]; threadId?: string };
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

        const model = anthropic("claude-sonnet-4-6");

        const tools = {
          search_corpus: tool({
            description: "READ-ONLY: Search the US federal legal corpus. Use this for your own research before proposing anything to the user.",
            inputSchema: z.object({
              q: z.string().min(2).describe("Search query"),
              source: z.enum(["usc", "cfr", "ucc", "const", "fedreg", "tfm", "irm"]).optional(),
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
          propose_search: tool({
            description: "Suggest a search the user might want to run. Renders as a chip with Run / Edit / Dismiss. Use when you don't have enough to answer or when the user would benefit from exploring a specific query themselves.",
            inputSchema: z.object({
              query: z.string().min(2).max(200),
              source: z.enum(["usc", "cfr", "ucc", "const", "fedreg"]).optional(),
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
          system: SYSTEM,
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