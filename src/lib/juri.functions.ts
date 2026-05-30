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

// ---------------------------------------------------------------------------
// System prompt — neutral, factual, grounded.
// ---------------------------------------------------------------------------

// NOTE: at ~600 tokens this prompt is below Sonnet 4.6's 2048-token cache floor,
// so the cache_control marker on it (see askJuri) is a no-op until the prompt
// grows past that floor — it just won't error. The real per-call cost in Juri is
// the retrieved document context in the user message, which varies per query and
// isn't cacheable. Left wired so caching activates automatically if this grows.
const SYSTEM_PROMPT = `You are Juri — the eagle of Marginalia, a citizen's index of actual U.S. law (the Constitution, the U.S. Code, the CFR, the UCC, agency manuals, and more). You help people read and understand the law in plain English.

You're sharp, direct, and a little dry — an eagle, not a paralegal reading off a script. Explain things the way a smart person explains them to another smart person, not the way a terms-of-service page reads.

HOW YOU WORK
- For each question you're handed the most relevant sections retrieved from the corpus. Treat those as your primary source: read them, say what they actually say, and cite what you draw from them as §[section_label] ([identifier]) so the user can click through and verify.
- Lead with the real answer. Then the supporting detail, cited. Then whatever complicates it — undefined terms, ambiguity, exceptions, jurisdictional splits.
- When the retrieved sections don't fully cover the question, say so and keep helping from what you know about the law generally. Just be honest about which is which: "the statute says X (cited); more broadly, courts tend to Y — general knowledge, worth verifying." Do NOT stonewall with "that's not on the shelf." You're Claude; act like it.
- If the question is really just a lookup ("what does 15 USC 1692g say"), give them the section.
- Lay out multi-step rules in order, with the authority for each step. When a term is defined in one section and used in another, connect them.

WHAT YOU ARE AND AREN'T
- You're a research tool, not the user's lawyer. Explaining what the law says, what it likely means, and what someone's options generally are — that's the job, so do it. But don't claim certainty you don't have, don't guarantee outcomes, and for anything high-stakes or about to be acted on, tell them to confirm against the cited text and check with a licensed attorney in their state.
- Plain English, no legalese, no hedging filler, no padding. If you don't know, say so.
- Match length to the question: a quick one gets a tight answer; a deep one can run long and map how the pieces connect.

If someone just wants to talk or kick the tires, engage with it — it's their credits to spend.`;

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

    // 4. Retrieve. Seed with a broad keyword search across ALL sources (plus the
    //    section the user is reading). In Deep mode, then follow the citation
    //    graph (citation_edges) out to the sections those hits connect to,
    //    ranked by doc_authority — "search all the law, find the connections."
    //    Quick mode skips the graph hop.
    const corpus = await getCorpusClient();
    type Doc = {
      id: number; identifier: string; source_code: string;
      section_label: string | null; heading: string | null;
      body_text: string | null; parent_label: string | null;
    };
    const DOC_COLS = "id, identifier, source_code, section_label, heading, body_text, parent_label";
    const seenIdent = new Set<string>();
    const pushDoc = (arr: Doc[], d: { id: number | string; identifier: string } & Partial<Doc>) => {
      if (!d || seenIdent.has(d.identifier)) return;
      seenIdent.add(d.identifier);
      arr.push({ ...(d as Doc), id: Number(d.id) });
    };

    const seeds: Doc[] = [];
    // The section the user is reading is always a seed.
    if (data.context_identifier) {
      const { data: doc } = await corpus
        .from("documents").select(DOC_COLS)
        .eq("identifier", data.context_identifier).maybeSingle();
      if (doc) pushDoc(seeds, doc as never);
    }

    // Broad keyword search across every source.
    const { data: searchResults } = await (corpus.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: { identifier: string }[] | null; error: unknown }>)(
      "search_documents_fts",
      { p_query: data.query, p_source: null, p_limit: profile.maxSeedDocs },
    );
    const seedIdents = (searchResults ?? [])
      .map((r) => r.identifier)
      .filter((id) => !seenIdent.has(id))
      .slice(0, profile.maxSeedDocs);
    if (seedIdents.length) {
      const { data: full } = await corpus
        .from("documents").select(DOC_COLS).in("identifier", seedIdents);
      for (const d of full ?? []) pushDoc(seeds, d as never);
    }

    // Deep mode: traverse the citation graph from the seeds.
    const connections: Doc[] = [];
    if (profile.useGraph && seeds.length) {
      const edgeDb = corpus as unknown as {
        from: (t: string) => {
          select: (c: string) => { in: (col: string, v: number[]) => Promise<{ data: Record<string, number | null>[] | null }> };
        };
      };
      const seedIds = seeds.map((d) => d.id).filter((n) => Number.isFinite(n));
      const [out, inc] = await Promise.all([
        edgeDb.from("citation_edges").select("target_id").in("source_id", seedIds),
        edgeDb.from("citation_edges").select("source_id").in("target_id", seedIds),
      ]);
      const connIds = new Set<number>();
      for (const e of out.data ?? []) if (e.target_id != null) connIds.add(Number(e.target_id));
      for (const e of inc.data ?? []) if (e.source_id != null) connIds.add(Number(e.source_id));
      for (const d of seeds) connIds.delete(d.id);
      let ranked = Array.from(connIds);
      if (ranked.length) {
        // Rank candidates by doc_authority; keep the strongest.
        const { data: auth } = await edgeDb.from("doc_authority").select("id, authority").in("id", ranked);
        const authMap = new Map((auth ?? []).map((a) => [Number(a.id), Number(a.authority) || 0]));
        ranked.sort((a, b) => (authMap.get(b) ?? 0) - (authMap.get(a) ?? 0));
        ranked = ranked.slice(0, profile.maxConnections);
        // documents.id is bigint at runtime; the generated types mistype it as
        // string (endemic — see documents.functions.ts). Cast to satisfy TS.
        const { data: connDocs } = await corpus
          .from("documents").select(DOC_COLS).in("id", ranked as unknown as string[]);
        for (const d of connDocs ?? []) pushDoc(connections, d as never);
      }
    }

    // 5. Assemble context within the mode's char budget (this is what bounds
    //    cost). Seeds first, then graph connections, until the budget is spent.
    const connSet = new Set(connections);
    const ordered = [...seeds, ...connections].filter((d) => d.body_text);
    const perDocCap = profile.useGraph ? 2400 : 3000;
    let usedChars = 0;
    const docs: Doc[] = [];
    const blocks: string[] = [];
    for (const d of ordered) {
      if (usedChars >= profile.maxContextChars) break;
      const body = (d.body_text ?? "").slice(0, perDocCap);
      const block = `--- ${connSet.has(d) ? "CONNECTED " : ""}DOCUMENT ---
Identifier: ${d.identifier}
Source: ${d.source_code}
Section: ${d.section_label ?? "N/A"}
Heading: ${d.heading ?? "N/A"}
Parent: ${d.parent_label ?? "N/A"}

${body}
--- END DOCUMENT ---`;
      blocks.push(block);
      docs.push(d);
      usedChars += block.length;
    }
    const docContext = blocks.join("\n\n");
    const sectionsRead = docs.length;
    const connectionsRead = docs.filter((d) => connSet.has(d)).length;

    // 6. Call Anthropic API. Note: an empty corpus result is NOT a hard refuse
    //    anymore — Juri still answers from general knowledge, flagged as such.
    const deepNote = mode === "deep"
      ? `\n\nThis is a DEEP search. Documents marked "CONNECTED DOCUMENT" were pulled in by following the citation graph out from the best matches. Use them to show how the law connects — cross-references, definitions that live in one section and bind another, and chains of authority. After the direct answer, map those connections explicitly.`
      : "";
    const userMessage = docs.length > 0
      ? `USER QUERY: ${data.query}

RELEVANT SECTIONS RETRIEVED FROM THE CORPUS:
${docContext}

Answer the user using these sections as your primary source — cite what you draw from them as §[section_label] ([identifier]). If they don't fully cover the question, say what's missing and fill the gap from your general legal knowledge, clearly marked as such.${deepNote}`
      : `USER QUERY: ${data.query}

No specific sections in the corpus matched this query. Help anyway from your general legal knowledge — be upfront that you're not citing retrieved text, give the user the lay of the land, and point them at what to search for (a code, a section number, better terms) to pull the actual law here on Marginalia.`;

    let answer = "";
    let tokensUsed = 0;
    let usage: Record<string, number> = {};
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: profile.maxTokens,
          // System prompt is static across every call — mark it cacheable so we
          // stop re-billing it at full input price. cache_control is GA (no beta
          // header). Caching only activates once the cached prefix clears Sonnet
          // 4.6's 2048-token floor; see note where SYSTEM_PROMPT is defined.
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("Anthropic API error:", res.status, errBody);
        return { ...EMPTY, error: "Juri couldn't process that right now. Try again." };
      }

      const result = await res.json();
      answer = (result.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
      usage = result.usage ?? {};
      tokensUsed =
        (usage.input_tokens ?? 0) +
        (usage.output_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0);
    } catch (e) {
      console.error("Juri API call failed:", e);
      return { ...EMPTY, error: "Couldn't reach the API. Try again in a moment." };
    }

    // 7. Meter the cost and charge credits (non-admin only). Credits scale with
    //    the model usage this answer actually incurred — a deep dive that read
    //    dozens of linked sections costs more than a quick lookup.
    const costCents = usageToCents(usage);
    const creditsCharged = isAdmin ? 0 : costToCredits(costCents, mode);
    if (!isAdmin && creditsCharged > 0) {
      await deductCredits(userId, creditsCharged);
    }

    // 8. Log the query
    const sourcesList = docs.map((d) => d.identifier);
    await logQuery(userId, data.query, sourcesList, tokensUsed, !isAdmin, creditsCharged, mode);

    // 9. Build citations list
    const citations: JuriCitation[] = docs.map((d) => ({
      identifier: d.identifier,
      section_label: d.section_label,
      heading: d.heading,
      source_code: d.source_code,
    }));

    const creditsRemaining = isAdmin ? 9999 : await getUserCredits(userId);

    return {
      answer,
      citations,
      credits_remaining: creditsRemaining,
      error: null,
      credits_charged: creditsCharged,
      sections_read: sectionsRead,
      connections_read: connectionsRead,
      mode,
    };
  });
