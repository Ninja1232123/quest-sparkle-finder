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

        // Outgoing citations: identifiers + headings the agent can cite next.
        const { data: outgoing } = await supabaseAdmin
          .from("doc_citations")
          .select("to_identifier, to_document_id")
          .eq("from_document_id", doc.id);
        const targetIds = (outgoing ?? []).map((c) => c.to_document_id).filter(Boolean) as string[];
        const targetMap = new Map<string, { heading: string | null; source_code: string }>();
        if (targetIds.length) {
          const { data: targets } = await supabaseAdmin
            .from("documents")
            .select("id, heading, source_code")
            .in("id", targetIds);
          for (const t of targets ?? []) targetMap.set(t.id, { heading: t.heading, source_code: t.source_code });
        }
        const citations = (outgoing ?? []).map((c) => {
          const t = c.to_document_id ? targetMap.get(c.to_document_id) : null;
          return {
            identifier: c.to_identifier,
            heading: t?.heading ?? null,
            url: canonicalUrl(c.to_identifier),
          };
        });

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