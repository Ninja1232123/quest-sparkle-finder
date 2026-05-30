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
const SYSTEM_PROMPT = `You are Juri, the eagle of Marginalia — a citizen's law index.

You are neutral, factual, and direct. You read statute and regulation text and explain what it says in plain English.

RULES — these are absolute:
1. Every factual claim MUST reference a specific section by its identifier from the provided documents. Format: §[section_label] ([identifier])
2. If text is ambiguous or a term is undefined, say so explicitly. Do NOT resolve ambiguity — flag it.
3. NEVER give legal advice. Never say "you should," "I recommend," or "this means you can." You translate, you don't advise.
4. If the answer isn't in the provided documents, say: "That's not on the shelf." Do not guess or use training knowledge about law.
5. Be concise. The statute speaks for itself. You make it legible, not longer.
6. If a statute requires multiple steps, list them as a numbered procedure with the authorizing section cited at each step.
7. When terms are defined in one section and used in another, note the cross-reference explicitly.
8. Speak in plain, direct English. No legalese in your explanations. No hedging language.
9. You are an eagle. Brief moments of personality are fine ("That section has teeth" or "Straightforward as written") but never at the expense of accuracy.

RESPONSE FORMAT:
- Lead with the direct answer in 1-3 sentences
- Follow with the relevant detail, cited
- End with any caveats (undefined terms, ambiguity, missing cross-references)
- Keep total response under 400 words unless the query specifically asks for a full breakdown`;

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

async function deductCredit(userId: string): Promise<boolean> {
  try {
    const cloud = await getCloudClient();
    // Atomic decrement — only if balance > 0
    const { data, error } = await cloud.rpc("deduct_juri_credit", { p_user_id: userId });
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function logQuery(
  userId: string | null,
  query: string,
  sources: string[],
  tokensUsed: number,
  credited: boolean,
) {
  try {
    const cloud = await getCloudClient();
    await cloud.from("juri_queries").insert({
      user_id: userId,
      query,
      sources_consulted: sources,
      tokens_used: tokensUsed,
      credited,
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
};

export const askJuri = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    query: z.string().min(3).max(500),
    // Optional: a specific section the user is currently reading
    context_identifier: z.string().max(300).optional(),
    // Auth token passed from client
    auth_token: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<JuriResponse> => {
    const EMPTY: JuriResponse = { answer: "", citations: [], credits_remaining: 0, error: null };

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

    // 3. Check credits (admin = unlimited)
    const isAdmin = isAdminEmail(userEmail);
    if (!isAdmin) {
      const balance = await getUserCredits(userId);
      if (balance <= 0) {
        return { ...EMPTY, credits_remaining: 0, error: "No credits. Pick some up to keep talking." };
      }
    }

    // 4. Search the corpus for relevant documents
    const corpus = await getCorpusClient();
    const docs: Array<{
      id: string;
      identifier: string;
      source_code: string;
      section_label: string | null;
      heading: string | null;
      body_text: string | null;
      parent_label: string | null;
    }> = [];

    // If user is reading a specific section, fetch it directly
    if (data.context_identifier) {
      const { data: doc } = await corpus
        .from("documents")
        .select("id, identifier, source_code, section_label, heading, body_text, parent_label")
        .eq("identifier", data.context_identifier)
        .maybeSingle();
      if (doc) docs.push(doc);
    }

    // Search for additional relevant documents
    type SearchRow = {
      identifier: string; source_code: string; parent_label: string | null;
      section_label: string | null; heading: string | null; snippet: string | null; rank: number;
    };
    const { data: searchResults, error: searchErr } = await (corpus.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>)(
      "search_documents_fts",
      { p_query: data.query, p_source: null, p_limit: 5 },
    );

    if (searchResults && searchResults.length > 0) {
      // Fetch full body_text for top results
      const ids = searchResults
        .map((r) => r.identifier)
        .filter((id) => !docs.some((d) => d.identifier === id))
        .slice(0, 4);

      if (ids.length > 0) {
        const { data: fullDocs } = await corpus
          .from("documents")
          .select("id, identifier, source_code, section_label, heading, body_text, parent_label")
          .in("identifier", ids);
        if (fullDocs) docs.push(...fullDocs);
      }
    }

    // 5. Build the context for the AI
    const docContext = docs
      .filter((d) => d.body_text)
      .map((d) => {
        const body = (d.body_text ?? "").slice(0, 3000); // Cap per doc
        return `--- DOCUMENT ---
Identifier: ${d.identifier}
Source: ${d.source_code}
Section: ${d.section_label ?? "N/A"}
Heading: ${d.heading ?? "N/A"}
Parent: ${d.parent_label ?? "N/A"}

${body}
--- END DOCUMENT ---`;
      })
      .join("\n\n");

    if (docs.length === 0) {
      // Still log the query for metadata collection
      await logQuery(userId, data.query, [], 0, false);
      const balance = isAdmin ? 9999 : await getUserCredits(userId);
      return {
        answer: "That's not on the shelf. Nothing in the corpus matched that query. Try rephrasing — a section number like \"15 USC 1692\" or broader terms like \"debt collection\" might land.",
        citations: [],
        credits_remaining: balance,
        error: null,
      };
    }

    // 6. Call Anthropic API
    const userMessage = `USER QUERY: ${data.query}

DOCUMENTS FROM THE CORPUS:
${docContext}

Read the documents above and answer the user's query. Cite every claim by its identifier. If the documents don't answer the query, say so.`;

    let answer = "";
    let tokensUsed = 0;
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
          max_tokens: 1200,
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
      const u = result.usage ?? {};
      tokensUsed =
        (u.input_tokens ?? 0) +
        (u.output_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0);
    } catch (e) {
      console.error("Juri API call failed:", e);
      return { ...EMPTY, error: "Couldn't reach the API. Try again in a moment." };
    }

    // 7. Deduct credit (non-admin only)
    if (!isAdmin) {
      await deductCredit(userId);
    }

    // 8. Log the query
    const sourcesList = docs.map((d) => d.identifier);
    await logQuery(userId, data.query, sourcesList, tokensUsed, !isAdmin);

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
    };
  });
