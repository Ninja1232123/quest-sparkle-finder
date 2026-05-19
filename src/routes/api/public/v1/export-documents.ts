import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

// GET /api/public/v1/export-documents
//   ?source=usc                 (optional filter by source_code)
//   &after=<id>                 (keyset cursor: last id from previous page)
//   &limit=1000                 (1..5000, default 1000)
//   &fields=embedding,body_text (comma list; default = all minus embedding)
//   &with_embedding=1           (shortcut to include embedding column)
//
// Returns: { rows: [...], next_after: string|null, count: number }
// Keyset paginated by id (uuid ascending) — stable, no offset cost.

const ALL_FIELDS = [
  "id","source_code","identifier","parent_label","section_label",
  "heading","body_text","body_md","hierarchy","sort_key","word_count",
  "created_at","embedding",
] as const;
type Field = typeof ALL_FIELDS[number];

export const Route = createFileRoute("/api/public/v1/export-documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        const url = new URL(request.url);
        const source = url.searchParams.get("source");
        const after = url.searchParams.get("after");
        const limitRaw = parseInt(url.searchParams.get("limit") ?? "1000", 10);
        const limit = Math.min(5000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 1000));
        const withEmbedding = url.searchParams.get("with_embedding") === "1";
        const fieldsParam = url.searchParams.get("fields");

        let fields: Field[];
        if (fieldsParam) {
          const requested = fieldsParam.split(",").map((s) => s.trim()).filter(Boolean);
          fields = requested.filter((f): f is Field => (ALL_FIELDS as readonly string[]).includes(f));
          if (fields.length === 0) return jsonResponse({ error: "no valid fields" }, { status: 400 });
          if (!fields.includes("id")) fields.unshift("id");
        } else {
          fields = ALL_FIELDS.filter((f) => f !== "embedding" || withEmbedding) as Field[];
        }

        let q = supabaseAdmin
          .from("documents")
          .select(fields.join(","))
          .order("id", { ascending: true })
          .limit(limit);
        if (source) q = q.eq("source_code", source);
        if (after) q = q.gt("id", after);

        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, { status: 500 });

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const next_after = rows.length === limit ? String(rows[rows.length - 1].id ?? "") : null;
        return jsonResponse({ rows, count: rows.length, next_after });
      },
    },
  },
});