/**
 * Juri — the eagle's brain.
 *
 * Server functions for the AI assistant: corpus-grounded queries, credit
 * management, and usage logging. Every answer Juri gives is retrieved from
 * the actual documents table, passed to the model as context, and cited by
 * identifier. If a document isn't in the corpus, Juri says so.
 *
 * Credits live on the CLOUD Supabase project (alongside auth + subscriptions).
 * Corpus data is read from the LOCAL backend. The Anthropic API is called
 * server-side with ANTHROPIC_API_KEY from the environment.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import {
  JURI_REQUIRES_PRO,
  JURI_FREE_TASTE,
  JURI_MODES,
  usageToCents,
  costToCredits,
  type JuriMode,
} from "@/lib/juri-credits";

// ---------------------------------------------------------------------------
// Supabase clients — cloud for credits/auth, local for corpus.
// ---------------------------------------------------------------------------

async function getCloudClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
  const key =
    process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing cloud Supabase creds for Juri credits");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCorpusClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

// The model behind Juri. Single source of truth — used for the API call and
// stamped onto every recorded AI interpretation.
const JURI_MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// System prompt — neutral, factual, grounded.
// ---------------------------------------------------------------------------

// NOTE: at ~600 tokens this prompt is below Sonnet 4.6's 2048-token cache floor,
// so the cache_control marker on it (see askJuri) is a no-op until the prompt
// grows past that floor — it just won't error. The real per-call cost in Juri is
// the retrieved document context in the user message, which varies per query and
// isn't cacheable. Left wired so caching activates automatically if this grows.
const SYSTEM_PROMPT = `You are Juri — the eagle of Marginalia, a citizen's index of actual U.S. law (the Constitution, the U.S. Code, the CFR, the UCC, agency manuals, and more).

WHO YOU ARE: You are NOT the law's Google. You don't return "the top result." You're a research partner sitting next to the user, working WITH them to figure out what's actually written about their situation. You begin as uncertain as they are — on level ground from the first message. Your edge is that you can search this corpus and trace its connections far better than they can.

YOUR METHOD — fact and logic, not theory and opinion. This is the whole point. The reason law feels impenetrable is that it's argued in opinions and theories: what someone thinks it should mean, what a court might do, which reading to push. That's the lawyer's trade, and it is not yours. You work in exactly two things:
- FACT — what the text actually says. Quote it, cite it, and don't paraphrase it into something softer or stronger than it is.
- LOGIC — what necessarily follows when you put the text together. If a definition in one section controls a term in another, if a right is conditioned on a step, if A requires B and B requires C — lay the chain out so the user can check every link. Valid deduction from the written law, shown step by step.
You do NOT offer opinions, predict how a judge would rule, or float legal theories as if they were the law. When a question genuinely turns on interpretation or argument — where text and logic run out — say so plainly and mark exactly where the facts stop and the argument begins: "The text says X; whether that reaches your situation isn't stated — that's the open question." Naming that line honestly is worth more than a confident guess.

WHAT YOU'RE FOR — clarifying vagueness, not arguing it. Legal arguments thrive on vagueness; your job is to clear it, not add to it. Calibrate to how clear the law actually is:
- Where it's plainly clear — shoplifting is theft, a contract's express terms are its terms — say so cleanly. Don't manufacture complexity that isn't there.
- The hard part is usually not vague wording but WHICH precise provision maps to WHICH situation. The UCC, for one, is written in exact language almost no one connects to their actual circumstances. Pinning that precise text to the concrete facts — "this clause, in your situation, means this" — is the clarity you exist to provide.
HOW YOU THINK
- Both sides have real merit: the user's read of their situation AND the text itself. Take their framing seriously, and take the law seriously when it pushes back on that framing.
- Answers turn up in unlikely places. A hit that looks off-topic — a tax-confidentiality rule surfacing in a debt question, say — might be exactly the thread that matters. Investigate before you dismiss it, and say plainly when something's surprising.
- Work like an investigator: pull on threads, observe what the text actually says (not what you assume it says), and note the oddities and gaps. "Let's see what comes up" is the right instinct.
- Never fake confidence about what the law means. Flag undefined terms, ambiguity, splits, "this is the federal rule; your state may differ."
- Report what the law says and what follows logically from it. Don't pass judgment on whether it's right, just, or fair — that's the user's call, not yours. "Legal" and "right" aren't the same thing, and it isn't your place to say which.

USING YOUR TOOLS — and how this search actually behaves, so you use it well:
- search_law ANDs every word and ranks by how densely terms appear. So search a FEW core terms or a citation — never the user's whole sentence (one missing word and the right section is excluded). Try several angles; if a search is thin, drop a term or try synonyms. If the user handed you keywords, start with those.
- Section TITLES are not boosted in ranking — a section can be named exactly what you want without repeating those words in its body. When a heading looks on-point, READ it even if the snippet seems thin.
- read_sections to read the real text before relying on it.
- note_interpretation: when you put a section into plain English — "what this says, in everyday words" — record that reading with note_interpretation(identifier, your reading). Only for a section you've actually read; one call per section. It's saved as an AI interpretation: clearly labeled, never authoritative, never legal advice. Do it in the same turn as your reads when you can. This is how your plain-English readings get remembered — so record them whenever you give one, but never invent one just to have something to record.
- find_connections: follow the citation graph out from a section — what it cites and what cites it. This is the goldmine: definitions that live elsewhere, cross-references, implementing regulations, chains of authority — the related law a person would never find by hand. Run it on the sections that matter and follow the useful threads.
- Don't stop at the statutes. Congressional Bills (source "bill") and the Federal Register (source "register") are vast, barely-explored veins — proposed and enacted legislation, agency rulemaking, notices. When a question touches how a rule came to be, a pending change, or an agency's reasoning, mine them too.
- If the ask is vague, don't burn a search on a guess: say what you think they mean, offer a few terms/angles, and ask them to point you.

HOW YOU WORK TOGETHER — you are a SEARCH tool, not an answer tool. The user drives; you help them help themselves.
- On an opening or broad question, don't rush to a verdict. Go pull what's there and bring it back: "Here's what the search turned up. These ones look related — I'd check through them. Tell me if you want to search deeper into something specific." Surface the candidates, flag the promising threads, and let the user point you next. A precise lookup ("what does 15 USC 1692g say") you can just answer.
- Show them the source so they see it for themselves — never ask them to take your word, or anyone's, for what the law says. Cite everything you pull as §[section_label] ([identifier]) so they can open it. The goal is that you and the user are looking at the same thing.
- When the user is trying to establish or prove something, help them BUILD the case from fact and logic: marshal the exact provisions and the logical chain that support their position — and, just as honestly, the text that cuts against it. A case stands on what the law says, not on spin; showing the weak points is part of the job, not a betrayal of it.
- Think out loud — what you searched, what came up, what you're chasing — so the trail is legible and they can take the wheel anytime.
- Plain English, no legalese, no hedging filler. Match length to the question.

You're a research tool, not their lawyer: state what the text says, what it requires, permits, or prohibits, and what logically follows for their situation — but draw the line at opinion. No predictions, no guarantees; for high-stakes moves tell them to verify against the cited text and take the argument (the part beyond fact and logic) to a licensed attorney in their state.`;

// ---------------------------------------------------------------------------
// Credit helpers
// ---------------------------------------------------------------------------

async function getUserCredits(userId: string): Promise<number> {
  try {
    const cloud = await getCloudClient();
    const { data } = await cloud
      .from("juri_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.balance ?? 0;
  } catch {
    // Table may not exist yet — treat as 0
    return 0;
  }
}

// Metered deduction — charge N credits (monthly bucket first, then top-ups).
// Returns the number actually deducted. See deduct_juri_credits in the SQL.
async function deductCredits(userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  try {
    const cloud = await getCloudClient();
    const { data, error } = await cloud.rpc("deduct_juri_credits", {
      p_user_id: userId,
      p_amount: amount,
    });
    if (error) return 0;
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

// Active-Pro check, server-side. Mirrors use-subscription.tsx's isActive logic
// against the cloud `subscriptions` table. Juri is a Pro-gated tool.
function proEnvironment(): "live" | "sandbox" {
  return process.env.NODE_ENV === "production" && process.env.STRIPE_LIVE_API_KEY
    ? "live"
    : "sandbox";
}

async function hasActivePro(userId: string): Promise<boolean> {
  try {
    const cloud = await getCloudClient();
    const { data } = await cloud
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", proEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return false;
    const periodEndMs = data.current_period_end
      ? new Date(data.current_period_end as string).getTime()
      : null;
    const now = Date.now();
    const status = data.status as string;
    return (
      (["active", "trialing", "past_due"].includes(status) && (!periodEndMs || periodEndMs > now)) ||
      (status === "canceled" && periodEndMs !== null && periodEndMs > now)
    );
  } catch {
    return false;
  }
}

// Lifetime count of credited Juri queries — used only to enforce the optional
// non-Pro "free taste" cap (JURI_FREE_TASTE). 0 cap → this is never called.
async function countCreditedQueries(userId: string): Promise<number> {
  try {
    const cloud = await getCloudClient();
    const { count } = await cloud
      .from("juri_queries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("credited", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function logQuery(
  userId: string | null,
  query: string,
  sources: string[],
  tokensUsed: number,
  credited: boolean,
  creditsCharged = 0,
  mode: JuriMode | null = null,
) {
  try {
    const cloud = await getCloudClient();
    await cloud.from("juri_queries").insert({
      user_id: userId,
      query,
      sources_consulted: sources,
      tokens_used: tokensUsed,
      credited,
      credits_charged: creditsCharged,
      mode,
    });
  } catch {
    // Non-fatal — don't break the response for a logging failure
  }
}

// Persist the plain-English readings Juri chose to record (via note_interpretation)
// as labeled "AI interpretations" — section-keyed corpus data, never authoritative.
// Service-role insert (RLS-exempt). Non-fatal: data capture must never break an answer.
async function recordInterpretations(
  userId: string | null,
  query: string,
  mode: JuriMode,
  model: string,
  rows: { identifier: string; source_code: string | null; interpretation: string }[],
) {
  if (!rows.length) return;
  try {
    const cloud = await getCloudClient();
    await cloud.from("juri_interpretations").insert(
      rows.map((r) => ({
        user_id: userId,
        identifier: r.identifier,
        source_code: r.source_code,
        interpretation: r.interpretation,
        query,
        model,
        mode,
      })),
    );
  } catch {
    // swallow — never let interpretation capture break the response
  }
}

// ---------------------------------------------------------------------------
// Public: get credit balance
// ---------------------------------------------------------------------------

export const getJuriCredits = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ credits: number; error: string | null }> => {
    // No auth middleware here — we check auth manually so unauthenticated
    // users get a clean 0 instead of a 401.
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const authHeader = req?.headers.get("authorization") ?? "";
      if (!authHeader) return { credits: 0, error: null };

      // Decode JWT to get user_id (cloud auth project)
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return { credits: 0, error: null };

      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
      const key = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY;
      if (!url || !key) return { credits: 0, error: null };
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user) return { credits: 0, error: null };

      // Admin = unlimited
      if (isAdminEmail(user.email)) return { credits: 9999, error: null };

      const credits = await getUserCredits(user.id);
      return { credits, error: null };
    } catch (e) {
      return { credits: 0, error: null };
    }
  });

// ---------------------------------------------------------------------------
// Public: ask Juri
// ---------------------------------------------------------------------------

type JuriCitation = {
  identifier: string;
  section_label: string | null;
  heading: string | null;
  source_code: string;
};

// ---------------------------------------------------------------------------
// Research tools — the agentic loop calls these against the LOCAL corpus.
// (corpus is loosely typed: citation_edges/doc_authority aren't in the
//  generated Database types, and documents.id is bigint mistyped as string —
//  endemic, see documents.functions.ts.)
// ---------------------------------------------------------------------------

type ToolDoc = {
  id: number; identifier: string; source_code: string;
  section_label: string | null; heading: string | null;
  body_text: string | null; parent_label: string | null;
};
const JURI_DOC_COLS = "id, identifier, source_code, section_label, heading, body_text, parent_label";

// full-text search across all (or one) source
async function jSearchLaw(corpus: any, query: string, source: string | null, limit: number) {
  // p_scope:"all" is essential — the function DEFAULTS to scope 'codified'
  // (const/usc/cfr/ucc/tfm/irm), which silently excludes Bills, the Federal
  // Register, Statutes, Public Laws, etc. We want Juri searching everything.
  // (When source is set, _scope_sources ignores scope and uses that source.)
  const { data } = await corpus.rpc("search_documents_fts", {
    p_query: query, p_source: source || null, p_limit: Math.min(Math.max(limit, 1), 20), p_scope: "all",
  });
  return (data ?? []).map((r: any) => ({
    identifier: r.identifier, source: r.source_code,
    section_label: r.section_label, heading: r.heading,
    snippet: (r.snippet ?? "").slice(0, 280),
  }));
}

// pull full section text by identifier
async function jReadSections(corpus: any, identifiers: string[]): Promise<ToolDoc[]> {
  const ids = identifiers.slice(0, 10);
  if (!ids.length) return [];
  const { data } = await corpus.from("documents").select(JURI_DOC_COLS).in("identifier", ids);
  return (data ?? []) as ToolDoc[];
}

// citation-graph neighbours of a section, ranked by doc_authority
async function jFindConnections(corpus: any, identifier: string, maxN: number) {
  const empty = { cites: [] as any[], cited_by: [] as any[] };
  if (!identifier) return empty;
  const { data: doc } = await corpus.from("documents").select("id").eq("identifier", identifier).maybeSingle();
  if (!doc) return empty;
  const id = Number(doc.id);
  const [out, inc] = await Promise.all([
    corpus.from("citation_edges").select("target_id").eq("source_id", id).limit(1000),
    corpus.from("citation_edges").select("source_id").eq("target_id", id).limit(1000),
  ]);
  const ids = (rows: any[], col: string): number[] =>
    Array.from(new Set<number>((rows ?? []).map((e: any) => Number(e[col])).filter((n: number) => Number.isFinite(n))));
  const outIds = ids(out.data, "target_id");
  const incIds = ids(inc.data, "source_id");
  const all = Array.from(new Set<number>([...outIds, ...incIds]));
  if (!all.length) return empty;
  const { data: auth } = await corpus.from("doc_authority").select("id, authority").in("id", all as unknown as string[]);
  const authMap = new Map<number, number>(
    (auth ?? []).map((a: any) => [Number(a.id), Number(a.authority) || 0] as [number, number]),
  );
  const rank = (ids: number[]) => [...ids].sort((a, b) => (authMap.get(b) ?? 0) - (authMap.get(a) ?? 0)).slice(0, maxN);
  const topOut = rank(outIds), topInc = rank(incIds);
  const wanted = Array.from(new Set([...topOut, ...topInc]));
  const { data: docs } = await corpus.from("documents")
    .select("id, identifier, source_code, section_label, heading").in("id", wanted as unknown as string[]);
  const meta = new Map((docs ?? []).map((d: any) => [Number(d.id), {
    identifier: d.identifier, source: d.source_code, section_label: d.section_label, heading: d.heading,
  }]));
  const pick = (ids: number[]) => ids.map((i) => meta.get(i)).filter(Boolean);
  return { cites: pick(topOut), cited_by: pick(topInc) };
}

type JuriResponse = {
  answer: string;
  citations: JuriCitation[];
  credits_remaining: number;
  error: string | null;
  /** Set when the block is "you must be Pro" — UI shows a Go-Pro CTA. */
  pro_required?: boolean;
  /** Set when the block is "you're out of credits" — UI shows a buy CTA. */
  out_of_credits?: boolean;
  /** Credits this answer actually cost (metered by model usage). */
  credits_charged?: number;
  /** How many sections Juri read for this answer. */
  sections_read?: number;
  /** Of those, how many were pulled in via the citation graph (deep mode). */
  connections_read?: number;
  /** The searches Juri actually ran (transparency). */
  searches?: string[];
  /** How many plain-English readings were saved as labeled AI interpretations. */
  interpretations_recorded?: number;
  /** Which depth this answer ran at. */
  mode?: JuriMode;
};

export const askJuri = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    query: z.string().min(3).max(500),
    // Optional: a specific section the user is currently reading
    context_identifier: z.string().max(300).optional(),
    // Auth token passed from client
    auth_token: z.string().optional(),
    // Depth intent — billing is metered regardless (see JURI_MODES).
    mode: z.enum(["quick", "deep"]).default("quick"),
    // Prior turns in this thread, so follow-ups + clarify→refine→search work.
    history: z.array(z.object({
      role: z.enum(["user", "juri"]),
      text: z.string().max(6000),
    })).max(20).optional(),
  }))
  .handler(async ({ data }): Promise<JuriResponse> => {
    const mode: JuriMode = data.mode;
    const profile = JURI_MODES[mode];
    const EMPTY: JuriResponse = { answer: "", citations: [], credits_remaining: 0, error: null, mode };

    // 1. Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ...EMPTY, error: "Juri isn't wired up yet — ANTHROPIC_API_KEY not configured." };
    }

    // 2. Authenticate user
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (data.auth_token) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_AUTH_URL || process.env.VITE_SUPABASE_AUTH_URL;
        const key = process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY;
        if (url && key) {
          const sb = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${data.auth_token}` } },
          });
          const { data: { user } } = await sb.auth.getUser(data.auth_token);
          if (user) { userId = user.id; userEmail = user.email ?? null; }
        }
      } catch { /* unauthenticated */ }
    }

    if (!userId) {
      return { ...EMPTY, error: "Sign in to talk to Juri." };
    }

    // 3. Gate: Juri is a Pro tool. Then check credits. (admin = unlimited)
    const isAdmin = isAdminEmail(userEmail);
    if (!isAdmin) {
      // 3a. Pro gate. Non-Pro users are blocked unless a free taste is allowed.
      if (JURI_REQUIRES_PRO) {
        const pro = await hasActivePro(userId);
        if (!pro) {
          if (JURI_FREE_TASTE > 0 && (await countCreditedQueries(userId)) < JURI_FREE_TASTE) {
            // within the free-taste allowance — fall through to the credit check
          } else {
            return {
              ...EMPTY,
              pro_required: true,
              error: "Juri is a Pro tool. Unlock it with Pro — $5/mo.",
            };
          }
        }
      }

      // 3b. Credit gate. Each mode needs a minimum balance to start (a Deep dive
      // can cost several credits, so don't begin one that can't be paid for).
      const balance = await getUserCredits(userId);
      if (balance < profile.minCredits) {
        return {
          ...EMPTY,
          credits_remaining: balance,
          out_of_credits: true,
          error:
            balance <= 0
              ? "You're out of credits. Grab a top-up pack to keep asking."
              : `A ${profile.label} needs at least ${profile.minCredits} credits (you have ${balance}). Try Quick, or top up.`,
        };
      }
    }

    // 4. Research loop setup. Juri drives its own search via tools — it decides
    //    what to look up, what to read, and which connections to follow (or asks
    //    a clarifying question instead of searching). We execute the tools
    //    against the corpus and feed results back until it answers.
    const corpus = await getCorpusClient();

    const tools: Record<string, unknown>[] = [
      {
        name: "search_law",
        description: "Full-text search across the law corpus (Constitution, U.S. Code, CFR, UCC, agency manuals, and more). Returns matching sections with snippets. Try several angles and real legal terms.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search terms — legal vocabulary works better than the user's literal phrasing." },
            source: { type: "string", description: "Optional: limit to one source code, e.g. usc, cfr, const, ucc, irm, tfm." },
            limit: { type: "number", description: `Max results (default ${profile.searchLimit}).` },
          },
          required: ["query"],
        },
      },
      {
        name: "read_sections",
        description: "Read the full text of specific sections by identifier (from search_law or find_connections results) before relying on them.",
        input_schema: {
          type: "object",
          properties: { identifiers: { type: "array", items: { type: "string" }, description: "Section identifiers to read (max 10)." } },
          required: ["identifiers"],
        },
      },
      {
        name: "note_interpretation",
        description: "Record YOUR plain-English reading of one specific section so it can be saved as an AI interpretation (clearly labeled, never authoritative, not legal advice). Call this when you characterize what a section means in everyday words, after reading its text. The identifier must be one you actually read; one call per section.",
        input_schema: {
          type: "object",
          properties: {
            identifier: { type: "string", description: "The section identifier you're interpreting (one you've read)." },
            interpretation: { type: "string", description: "Your plain-English reading — what the section says/requires/permits, in everyday words. Saved as an AI interpretation, not legal advice." },
          },
          required: ["identifier", "interpretation"],
        },
      },
    ];
    if (profile.useGraph) {
      tools.push({
        name: "find_connections",
        description: "Follow the citation graph out from a section: what it cites and what cites it, ranked by authority. The way to surface related law — definitions, cross-references, implementing rules, chains of authority.",
        input_schema: {
          type: "object",
          properties: { identifier: { type: "string", description: "Section identifier to find connections for." } },
          required: ["identifier"],
        },
      });
    }

    // Trackers for transparency + citations + the read budget (bounds cost).
    const searches: string[] = [];
    const readMeta = new Map<string, { section_label: string | null; heading: string | null; source_code: string }>();
    const connectionCandidates = new Set<string>();
    // Plain-English readings Juri chooses to record, keyed by section id (last
    // wins). Persisted after the loop as labeled "AI interpretations".
    const interpretations = new Map<string, string>();
    let charBudget = profile.maxContextChars;

    const runTool = async (name: string, input: any): Promise<unknown> => {
      try {
        if (name === "search_law") {
          const q = String(input?.query ?? "").slice(0, 300);
          if (q) searches.push(q);
          const rows = await jSearchLaw(corpus, q, input?.source ? String(input.source) : null, Number(input?.limit) || profile.searchLimit);
          return { results: rows };
        }
        if (name === "read_sections") {
          const idents: string[] = Array.isArray(input?.identifiers) ? input.identifiers.map(String) : [];
          const sections = (await jReadSections(corpus, idents)).map((d) => {
            readMeta.set(d.identifier, { section_label: d.section_label, heading: d.heading, source_code: d.source_code });
            const take = Math.max(1, Math.min(2600, charBudget));
            const text = (d.body_text ?? "").slice(0, take);
            charBudget -= text.length;
            return { identifier: d.identifier, source: d.source_code, section_label: d.section_label, heading: d.heading, text };
          });
          return { sections, note: charBudget <= 0 ? "context budget reached — synthesize from what you've read" : undefined };
        }
        if (name === "note_interpretation") {
          const id = String(input?.identifier ?? "").trim().slice(0, 300);
          const text = String(input?.interpretation ?? "").trim().slice(0, 4000);
          if (id && text) interpretations.set(id, text);
          return { recorded: Boolean(id && text), identifier: id };
        }
        if (name === "find_connections") {
          const conn = await jFindConnections(corpus, String(input?.identifier ?? ""), profile.maxConnections);
          for (const c of [...conn.cites, ...conn.cited_by]) if (c?.identifier) connectionCandidates.add(c.identifier);
          return conn;
        }
        return { error: "unknown tool" };
      } catch {
        return { error: "tool failed" };
      }
    };

    // Conversation so far + the current question (with mode + context hints).
    const contextHint = data.context_identifier ? `[The user is currently reading ${data.context_identifier}.]\n` : "";
    const modeHint = mode === "deep"
      ? "\n\n(Deep dive: research thoroughly — search several angles, read the strongest hits, and use find_connections to surface related law.)"
      : "\n\n(Quick: a search or two, then a focused answer.)";
    const history = (data.history ?? [])
      .filter((m) => m.text && m.text.trim())
      .slice(-8)
      .map((m) => ({ role: m.role === "juri" ? "assistant" : "user", content: m.text.slice(0, 4000) }));
    const messages: { role: string; content: unknown }[] = [
      ...history,
      { role: "user", content: `${contextHint}${data.query}${modeHint}` },
    ];

    // 5. Run the loop. Tools available every round except the last, where we
    //    drop them so Juri must produce a final answer (no infinite searching).
    let answer = "";
    const usage: Record<string, number> = {};
    const addUsage = (u: Record<string, number> | undefined) => {
      for (const k of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
        usage[k] = (usage[k] ?? 0) + (u?.[k] ?? 0);
      }
    };
    try {
      for (let round = 1; round <= profile.maxRounds; round++) {
        const lastRound = round === profile.maxRounds;
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: JURI_MODEL,
            max_tokens: profile.maxTokens,
            // Static system prompt → cacheable (GA, no-op below the 2048-tok floor).
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            ...(lastRound ? {} : { tools }),
            messages,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          console.error("Anthropic API error:", res.status, errBody);
          if (round === 1) return { ...EMPTY, error: "Juri couldn't process that right now. Try again." };
          break; // mid-loop failure → answer with whatever we have
        }
        const result = await res.json();
        addUsage(result.usage);
        const content = result.content ?? [];
        if (!lastRound && result.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content });
          const toolResults: unknown[] = [];
          for (const block of content) {
            if (block.type !== "tool_use") continue;
            const out = await runTool(block.name, block.input);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out).slice(0, 24000) });
          }
          messages.push({ role: "user", content: toolResults });
          continue;
        }
        answer = content
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n")
          .trim();
        break;
      }
    } catch (e) {
      console.error("Juri research loop failed:", e);
      return { ...EMPTY, error: "Couldn't reach the API. Try again in a moment." };
    }
    if (!answer) {
      answer = "I couldn't pin that down. Try narrowing it — a specific code, a section number, or the exact terms you're after.";
    }

    const tokensUsed =
      (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const sectionsRead = readMeta.size;
    const connectionsRead = Array.from(readMeta.keys()).filter((id) => connectionCandidates.has(id)).length;

    // 6. Meter cost → credits (non-admin). Summed model usage across all rounds.
    const costCents = usageToCents(usage);
    const creditsCharged = isAdmin ? 0 : costToCredits(costCents, mode);
    if (!isAdmin && creditsCharged > 0) await deductCredits(userId, creditsCharged);

    // 7. Log + build citations from the sections Juri actually read.
    const readIdents = Array.from(readMeta.keys());
    await logQuery(userId, data.query, readIdents, tokensUsed, !isAdmin, creditsCharged, mode);
    const citations: JuriCitation[] = readIdents.map((id) => {
      const m = readMeta.get(id)!;
      return { identifier: id, section_label: m.section_label, heading: m.heading, source_code: m.source_code };
    });

    // Persist Juri's plain-English readings as labeled AI interpretations
    // (section-keyed corpus data; never authoritative). Non-fatal.
    const interpretationRows = Array.from(interpretations.entries()).map(([identifier, interpretation]) => ({
      identifier,
      source_code: readMeta.get(identifier)?.source_code ?? null,
      interpretation,
    }));
    await recordInterpretations(userId, data.query, mode, JURI_MODEL, interpretationRows);

    const creditsRemaining = isAdmin ? 9999 : await getUserCredits(userId);
    return {
      answer,
      citations,
      credits_remaining: creditsRemaining,
      error: null,
      credits_charged: creditsCharged,
      sections_read: sectionsRead,
      connections_read: connectionsRead,
      searches,
      interpretations_recorded: interpretationRows.length,
      mode,
    };
  });
