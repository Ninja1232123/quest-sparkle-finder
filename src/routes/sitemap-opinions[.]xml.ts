import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getOpinionSitemapSlugs } from "@/lib/opinions.functions";

const BASE_URL = "https://self-law.org";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The "opinions" child of the sitemap index: every Court Record opinion page
// (~28.5k) plus the index. Under the 50k single-sitemap cap, so one file.
export const Route = createFileRoute("/sitemap-opinions.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { slugs } = await getOpinionSitemapSlugs();
        const locs = ["/record", ...slugs.map((s) => `/record/${s}`)];
        const urls = locs
          .map((loc) =>
            [
              `  <url>`,
              `    <loc>${xmlEscape(BASE_URL + loc)}</loc>`,
              `    <changefreq>yearly</changefreq>`,
              `    <priority>${loc === "/record" ? "0.7" : "0.4"}</priority>`,
              `  </url>`,
            ].join("\n"),
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
