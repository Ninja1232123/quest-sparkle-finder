import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { embed, embedMany } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Model used for embedding. Must be available on your AI gateway.
// text-embedding-3-small: 1536 dims, fast, cheap — default.
// voyage-law-2:           1024 dims, purpose-built for legal text — requires
//   recreating the vector(1536) column as vector(1024) and a full re-backfill.
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

function getEmbeddingModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set — add it to your environment to enable semantic search.");
  return createLovableAiGatewayProvider(key).textEmbeddingModel(EMBEDDING_MODEL);
}

// Text we embed for each document: label + heading + first 1500 chars of body.
// Keeps context focused; cheap to recompute if the model changes.
function buildEmbedInput(doc: { section_label: string | null; heading: string | null; body_text: string | null }): string {
  const parts = [doc.section_label, doc.heading, (doc.body_text ?? "").slice(0, 1500)].filter(Boolean);
  return parts.join(" — ");
}

// Generate a single embedding vector for a query string.
// Used at search time (low latency path, <200 ms on most gateways).
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: query,
    });
    return embedding;
  } catch (err) {
    console.error("[embeddings] query embedding failed:", err);
    return null;
  }
}

// ── Admin / backfill server functions ────────────────────────────────────────

export const getEmbeddingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const [totalRes, embeddedRes] = await Promise.all([
    supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("documents").select("id", { count: "exact", head: true }).not("embedding", "is", null),
  ]);
  const total = totalRes.count ?? 0;
  const embedded = embeddedRes.count ?? 0;
  return { total, embedded, pending: total - embedded };
});

export const runEmbeddingBatch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ batch_size: z.number().int().min(1).max(200).default(100) }))
  .handler(async ({ data }) => {
    const model = getEmbeddingModel(); // throws if no API key

    // Fetch the next batch of un-embedded documents.
    const { data: docs, error } = await supabaseAdmin
      .from("documents")
      .select("id, section_label, heading, body_text")
      .is("embedding", null)
      .limit(data.batch_size);

    if (error) return { processed: 0, error: error.message };
    if (!docs || docs.length === 0) return { processed: 0, error: null };

    // Generate embeddings for the batch in a single API call.
    const values = docs.map(buildEmbedInput);
    const { embeddings } = await embedMany({ model, values });

    // Write embeddings back to the DB row-by-row.
    // Could be a single upsert but the ids aren't ordered, so updates are simpler.
    const updates = docs.map((doc, i) =>
      supabaseAdmin
        .from("documents")
        .update({ embedding: embeddings[i] as unknown as string })
        .eq("id", doc.id)
    );
    await Promise.all(updates);

    return { processed: docs.length, error: null };
  });
