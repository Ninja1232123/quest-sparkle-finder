// Query-side embedding for semantic search.
//
// The fast_text vectors (7.6M chunks, 300-dim) were built by a fastText model
// trained on the corpus (`fast_text-self_law.bin`). To search that space we
// must embed the QUERY with the exact same model — so we call the self-hosted
// fastText service on the box (`scripts/fasttext-embed-service.py`, behind the
// `/embed` route on the Cloudflare tunnel). Vercel can't reach the box's
// localhost directly, hence going through the tunnel like the DB does.
//
// Returns null on any failure (service down, timeout, bad shape) so search
// cleanly falls back to keyword/FTS — semantic is always best-effort.
//
// NOTE: the old OpenAI/admin embedding path (text-embedding-3-small → the empty
// document_sections.embedding column) was removed — it was pre-Vercel, wrong
// dimension (1536 vs 300), and search_hybrid reads fast_text, not that column.

export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const base = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: query }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { vector?: number[]; dim?: number };
    return Array.isArray(data.vector) && data.vector.length > 0 ? data.vector : null;
  } catch (err) {
    console.error("[embeddings] query embedding failed:", err);
    return null;
  }
}
