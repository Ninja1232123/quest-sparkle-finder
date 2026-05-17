import { createFileRoute } from "@tanstack/react-router";
import { bestExcerpt, canonicalUrl, formatCitation, jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

export const Route = createFileRoute("/api/public/v1/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        const url = new URL(request.url);
        const identifier = (url.searchParams.get("identifier") ?? "").trim();
        const q = (url.searchParams.get("q") ?? "").trim();
        const maxLen = Math.min(Math.max(parseInt(url.searchParams.get("max_len") ?? "420", 10) || 420, 80), 1200);

        if (!identifier || identifier.length > 300 || !/^[a-z0-9._\-\/]+$/i.test(identifier)) {
          return jsonResponse({ error: "invalid identifier" }, { status: 400 });
        }

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("source_code, identifier, section_label, heading, body_text")
          .eq("identifier", identifier)
          .maybeSingle();
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        if (!doc) return jsonResponse({ error: "not found" }, { status: 404 });

        const body = doc.body_text ?? "";
        const excerpt = q ? bestExcerpt(body, q, maxLen) : body.slice(0, maxLen).trim();
        const citation = formatCitation(doc.source_code, doc.identifier, doc.section_label);
        const url_canonical = canonicalUrl(doc.identifier);

        return jsonResponse({
          identifier: doc.identifier,
          source: doc.source_code,
          heading: doc.heading,
          citation,
          url: url_canonical,
          quote: excerpt,
          // Ready-to-paste markdown for Reddit / blog posts.
          markdown: `> ${excerpt.replace(/\n+/g, " ")}\n\n— [${citation}](${url_canonical})`,
        });
      },
    },
  },
});