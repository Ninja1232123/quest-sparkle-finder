import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

// POST /api/public/v1/ingest-batch
// Body: { source_code?: string, rows: DocRow[] }   (max 1000 rows / ~6 MB)
// Upserts into public.documents (onConflict: identifier, ignoreDuplicates).

type DocRow = {
  source_code?: string | null;
  identifier?: string | null;
  parent_label?: string | null;
  section_label?: string | null;
  heading?: string | null;
  body_text?: string | null;
  body_md?: string | null;
  hierarchy?: unknown;
  sort_key?: string | null;
  word_count?: number | null;
};

const COLS = [
  "source_code","identifier","parent_label","section_label",
  "heading","body_text","body_md","hierarchy","sort_key","word_count",
] as const;

function normalize(row: DocRow, fallback?: string) {
  const source_code = (row.source_code ?? fallback ?? "").toString().trim();
  const identifier = (row.identifier ?? "").toString().trim().replace(/^\/+/, "");
  if (!source_code || !identifier) return null;
  const out: Record<string, unknown> = { source_code, identifier };
  for (const k of COLS) {
    if (k === "source_code" || k === "identifier") continue;
    const v = (row as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const Route = createFileRoute("/api/public/v1/ingest-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        let body: { source_code?: string; rows?: DocRow[] };
        try { body = await request.json(); }
        catch { return jsonResponse({ error: "invalid json" }, { status: 400 }); }

        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (rows.length === 0) return jsonResponse({ error: "rows required" }, { status: 400 });
        if (rows.length > 1000) return jsonResponse({ error: "max 1000 rows per batch" }, { status: 400 });

        const batch: Record<string, unknown>[] = [];
        let skipped = 0;
        for (const r of rows) {
          const n = normalize(r, body.source_code);
          if (n) batch.push(n); else skipped++;
        }

        if (batch.length === 0) {
          return jsonResponse({ inserted: 0, skipped, error: "no valid rows" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from("documents")
          .upsert(batch as unknown as never, { onConflict: "identifier", ignoreDuplicates: true });

        if (error) {
          return jsonResponse({ error: error.message, inserted: 0, skipped }, { status: 500 });
        }
        return jsonResponse({ inserted: batch.length, skipped });
      },
    },
  },
});