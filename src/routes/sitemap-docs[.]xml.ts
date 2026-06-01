import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/agent-api.server";

const BASE_URL = "https://self-law.org";
// Sitemaps cap at 50,000 URLs each; 5,000 keeps every page well under the limit
// and matches the row count the export endpoint already pulls in one request.
// MUST stay in sync with PAGE_SIZE in sitemap.xml.ts (the index computes page
// counts from it).
const PAGE_SIZE = 5000;

// Percent-encode each path segment while preserving the "/" separators, so messy
// identifiers (e.g. the CFR "/us/cfr/t29/s§ 1910.95" with a literal § and space)
// become valid, crawlable URLs. encodeURIComponent also escapes &, <, > so the
// resulting <loc> is XML-safe without further escaping.
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// One page of document URLs for a single source. The reader lives at
// /code/<identifier> (see routes/code.$.tsx), and identifiers begin with "/",
// so the public path is simply "/code" + identifier. Paged by id (ascending),
// which is stable across requests; the parent /sitemap.xml lists every page.
export const Route = createFileRoute("/sitemap-docs.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const source = url.searchParams.get("source") ?? "";
        const pageRaw = parseInt(url.searchParams.get("page") ?? "0", 10);
        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 0;
        if (!source) return new Response("missing source", { status: 400 });

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabaseAdmin
          .from("documents")
          .select("identifier")
          .eq("source_code", source)
          .order("id", { ascending: true })
          .range(from, to);
        if (error) return new Response(error.message, { status: 500 });

        const rows = (data ?? []) as { identifier: string }[];
        const urls = rows
          .map((r) => `  <url>\n    <loc>${BASE_URL}${encodePath("/code" + r.identifier)}</loc>\n  </url>`)
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
