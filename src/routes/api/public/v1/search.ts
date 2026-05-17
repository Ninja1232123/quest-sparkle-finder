import { createFileRoute } from "@tanstack/react-router";
import { canonicalUrl, formatCitation, jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

type SearchRow = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string | null;
  rank: number;
};

export const Route = createFileRoute("/api/public/v1/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim();
        const source = url.searchParams.get("source")?.trim() || null;
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 1), 50);

        if (q.length < 2 || q.length > 200) {
          return jsonResponse({ error: "q must be 2–200 characters" }, { status: 400 });
        }
        if (source && !/^[a-z]{2,10}$/.test(source)) {
          return jsonResponse({ error: "invalid source" }, { status: 400 });
        }

        const { data, error } = await (supabaseAdmin.rpc as unknown as (
          fn: string, args: Record<string, unknown>,
        ) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>)(
          "search_documents_fts",
          { p_query: q, p_source: source, p_limit: limit },
        );
        if (error) return jsonResponse({ error: error.message }, { status: 500 });

        const results = (data ?? []).map((r) => ({
          identifier: r.identifier,
          source: r.source_code,
          heading: r.heading,
          section_label: r.section_label,
          parent_label: r.parent_label,
          citation: formatCitation(r.source_code, r.identifier, r.section_label),
          url: canonicalUrl(r.identifier),
          snippet: (r.snippet ?? "").replace(/<\/?mark>/g, ""),
          rank: r.rank,
        }));

        return jsonResponse({ query: q, source, count: results.length, results });
      },
    },
  },
});