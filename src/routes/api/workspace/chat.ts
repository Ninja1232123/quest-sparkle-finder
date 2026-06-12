// Workspace chat endpoint — AI SDK streamText with corpus tools.
// Auth: validates the bearer against the cloud Supabase project, then scopes
// every read/write to that user via service-role with explicit WHERE filters.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are the Marginalia Workspace — an AI legal research and drafting assistant for pro se litigants.

RULES (non-negotiable):
- ALWAYS use search_corpus before answering any legal question. Do not rely on memory.
- ALWAYS cite using the returned citation (e.g. "42 U.S.C. § 1983") and identifier.
- PREFER quoting the operative statutory or regulatory language over paraphrasing.
- When the user asks for a draft (motion, complaint, demand letter, contract, memo), use search_corpus to gather authority, then call draft_document. Always include a "Citations" footer in the body_md with full identifiers and short pin-cites.
- After drafting, you may proactively run cite_check on the draft to surface any citations that don't resolve.
- Use export_document only when the user asks to download.
- End substantive legal answers with: "_This is general legal information, not legal advice. Consult a licensed attorney for your specific situation._"
- Respond in clear markdown. Inline-link citations as [42 U.S.C. § 1983](/code/usc/42/1983) when you cite the corpus.`;

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

function userScopedDataClient(token: string) {
  // Data tables live in the local data project; reads use that client. We
  // attach the user's bearer so RLS applies for workspace_* writes/reads.
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CITATION_REGEX = /\b(\d+)\s+(U\.S\.C\.|C\.F\.R\.)\s+§+\s*([\w.\-]+)/g;

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
        const supabase = userScopedDataClient(token);

        // Verify thread ownership
        const { data: thread } = await supabase
          .from("workspace_threads")
          .select("id,user_id,title")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread || thread.user_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          search_corpus: tool({
            description: "Search the US federal legal corpus (USC, CFR, UCC, Constitution, Federal Register, etc.) by keyword or natural-language query. Returns ranked hits with identifier, citation, snippet, url.",
            inputSchema: z.object({
              q: z.string().min(2).describe("Search query"),
              source: z.enum(["usc", "cfr", "ucc", "const", "fedreg", "tfm", "irm"]).optional(),
              limit: z.number().int().min(1).max(20).default(8),
            }),
            execute: async ({ q, source, limit }) => {
              const { data, error } = await supabase.rpc("search_documents_fts", {
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
            description: "Fetch the full text and outgoing citations of one document by identifier (e.g. 'usc/42/1983').",
            inputSchema: z.object({ identifier: z.string() }),
            execute: async ({ identifier }) => {
              const { data, error } = await supabase
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
          draft_document: tool({
            description: "Save a drafted legal document (motion, complaint, demand letter, contract, memo) to the workspace. Include full markdown body with a Citations footer. Returns a document id that becomes downloadable.",
            inputSchema: z.object({
              kind: z.enum(["motion", "complaint", "demand_letter", "contract", "memo", "brief", "other"]),
              title: z.string().min(1).max(200),
              body_md: z.string().min(10),
              citations: z.array(z.object({
                identifier: z.string(),
                citation: z.string(),
              })).default([]),
            }),
            execute: async ({ kind, title, body_md, citations }) => {
              const { data, error } = await supabase
                .from("workspace_documents")
                .insert({ thread_id: threadId, user_id: userId, kind, title, body_md, citations })
                .select("id,title,kind")
                .single();
              if (error) return { error: error.message };
              return { ok: true, document_id: data.id, title: data.title, kind: data.kind };
            },
          }),
          cite_check: tool({
            description: "Scan a block of text for legal citations (USC, CFR) and report which resolve to the corpus and which do not.",
            inputSchema: z.object({ text: z.string().min(10) }),
            execute: async ({ text }) => {
              const matches = Array.from(text.matchAll(CITATION_REGEX));
              const idents = matches.map((m) => {
                const kind = m[2] === "U.S.C." ? "usc" : "cfr";
                return { raw: m[0], identifier: `${kind}/${m[1]}/${m[3]}` };
              });
              if (idents.length === 0) return { found: [], missing: [], note: "No USC/CFR citations detected." };
              const { data } = await supabase
                .from("documents")
                .select("identifier")
                .in("identifier", idents.map((i) => i.identifier));
              const found = new Set((data ?? []).map((d: { identifier: string }) => d.identifier));
              return {
                found: idents.filter((i) => found.has(i.identifier)),
                missing: idents.filter((i) => !found.has(i.identifier)),
              };
            },
          }),
          export_document: tool({
            description: "Generate a downloadable file for a previously drafted document. Returns a path the user can open.",
            inputSchema: z.object({
              document_id: z.string().uuid(),
              format: z.enum(["docx", "pdf", "md"]).default("md"),
            }),
            execute: async ({ document_id, format }) => {
              const { data } = await supabase
                .from("workspace_documents")
                .select("id,title")
                .eq("id", document_id)
                .maybeSingle();
              if (!data) return { error: "Document not found" };
              return {
                ok: true,
                download_url: `/workspace/doc/${document_id}?format=${format}`,
                title: data.title,
                format,
              };
            },
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM,
          messages: convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            try {
              // Replace stored messages with the new full transcript (simpler than diffing).
              await supabase.from("workspace_messages").delete().eq("thread_id", threadId);
              const rows = messages.map((m) => ({
                thread_id: threadId,
                user_id: userId,
                role: m.role,
                parts: m.parts,
              }));
              if (rows.length > 0) {
                await supabase.from("workspace_messages").insert(rows);
              }
              // Auto-title from first user message if still default
              if (thread.title === "New session" || thread.title === "Continued from chat") {
                const firstUser = messages.find((m) => m.role === "user");
                const text = firstUser?.parts
                  ?.map((p: { type: string; text?: string }) => (p.type === "text" ? p.text ?? "" : ""))
                  .join(" ")
                  .trim();
                if (text) {
                  await supabase
                    .from("workspace_threads")
                    .update({ title: text.slice(0, 80), last_message_at: new Date().toISOString() })
                    .eq("id", threadId);
                }
              } else {
                await supabase
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