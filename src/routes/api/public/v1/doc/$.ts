import { createFileRoute } from "@tanstack/react-router";
import { canonicalUrl, formatCitation, jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

export const Route = createFileRoute("/api/public/v1/doc/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        const identifier = (params._splat ?? "").trim();
        if (!identifier || identifier.length > 300 || !/^[a-z0-9._\-\/]+$/i.test(identifier)) {
          return jsonResponse({ error: "invalid identifier" }, { status: 400 });
        }

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, source_code, identifier, parent_label, section_label, heading, body_text, body_md, word_count")
          .eq("identifier", identifier)
          .maybeSingle();
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        if (!doc) return jsonResponse({ error: "not found" }, { status: 404 });

        // Outgoing citations: resolved targets the agent can cite next. Sourced
        // from citation_edges (not the old phantom doc_citations). It isn't in
        // the generated Database types, so use a loose handle — service_role
        // already has SELECT on it.
        const edgeDb = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (cols: string) => {
              eq: (c: string, v: number) => { limit: (n: number) => Promise<{ data: { target_id: number | null }[] | null }> };
            };
          };
        };
        const { data: edges } = await edgeDb
          .from("citation_edges")
          .select("target_id")
          .eq("source_id", doc.id)
          .limit(2000);
        const targetIds = Array.from(
          new Set((edges ?? []).map((e) => e.target_id).filter((x): x is number => x != null)),
        ).slice(0, 800);
        const targetMap = new Map<number, { identifier: string; heading: string | null }>();
        if (targetIds.length) {
          const { data: targets } = await supabaseAdmin
            .from("documents")
            .select("id, identifier, heading")
            .in("id", targetIds);
          for (const t of targets ?? []) targetMap.set(t.id as number, { identifier: t.identifier, heading: t.heading });
        }
        const citations = targetIds
          .map((id) => targetMap.get(id))
          .filter((t): t is { identifier: string; heading: string | null } => !!t)
          .map((t) => ({ identifier: t.identifier, heading: t.heading, url: canonicalUrl(t.identifier) }));

        return jsonResponse({
          identifier: doc.identifier,
          source: doc.source_code,
          heading: doc.heading,
          section_label: doc.section_label,
          parent_label: doc.parent_label,
          citation: formatCitation(doc.source_code, doc.identifier, doc.section_label),
          url: canonicalUrl(doc.identifier),
          word_count: doc.word_count,
          body_text: doc.body_text,
          body_md: doc.body_md,
          citations,
        });
      },
    },
  },
});