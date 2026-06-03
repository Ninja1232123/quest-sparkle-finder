import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getOutcomeSitemapSlugs } from "@/lib/outcomes.functions";

const BASE_URL = "https://self-law.org";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Priority by page scope — apex hubs first, individual court×claim leaves lowest.
function priorityFor(scope: string): string {
  switch (scope) {
    case "family_national": return "0.8";
    case "casetype_national": return "0.7";
    case "court": return "0.6";
    default: return "0.5"; // court_casetype
  }
}

// The "outcomes" child of the sitemap index: every Court Outcomes page
// (family / case-type / court / court×case-type). ~7k URLs — well under the
// 50k single-sitemap cap, so it lives in one file.
export const Route = createFileRoute("/sitemap-outcomes.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { slugs } = await getOutcomeSitemapSlugs();

        // Leaf pages live in stat_page. The aggregate landings (/outcomes/states
        // and each /outcomes/states/<state>) are route-only, so derive them here.
        const entries: { loc: string; priority: string }[] = slugs.map(({ slug, scope }) => ({
          loc: slug,
          priority: priorityFor(scope),
        }));
        const stateLandings = new Set<string>();
        for (const { slug, scope } of slugs) {
          if (scope !== "state_court") continue;
          const parts = slug.split("/"); // ["", "outcomes", "states", <state>, <court>]
          if (parts.length >= 4) stateLandings.add(`/outcomes/states/${parts[3]}`);
        }
        entries.push({ loc: "/outcomes/states", priority: "0.8" });
        for (const loc of stateLandings) entries.push({ loc, priority: "0.7" });

        const urls = entries
          .map(({ loc, priority }) =>
            [
              `  <url>`,
              `    <loc>${xmlEscape(BASE_URL + loc)}</loc>`,
              `    <changefreq>monthly</changefreq>`,
              `    <priority>${priority}</priority>`,
              `  </url>`,
            ].join("\n"),
          )
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
