import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { TOPICS } from "@/data/topics";
import { CODEBOOKS } from "@/lib/codebooks";

const BASE_URL = "https://self-law.org";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/code", changefreq: "weekly", priority: "0.9" },
          { path: "/search", changefreq: "weekly", priority: "0.7" },
          { path: "/compare", changefreq: "weekly", priority: "0.7" },
          { path: "/library", changefreq: "monthly", priority: "0.7" },
          { path: "/whitepaper", changefreq: "monthly", priority: "0.6" },
          { path: "/forum", changefreq: "daily", priority: "0.6" },
          { path: "/stacks", changefreq: "weekly", priority: "0.6" },
          { path: "/subscribe", changefreq: "monthly", priority: "0.5" },
        ];

        const sources = ["const", "usc", "cfr", "ucc", "tfm", "irm"];
        const sourcePaths: SitemapEntry[] = sources.map((s) => ({
          path: `/code/source/${s}`,
          changefreq: "weekly",
          priority: "0.7",
        }));

        const codebookPaths: SitemapEntry[] = CODEBOOKS.map((cb) => ({
          path: `/${cb.slug}`,
          changefreq: "weekly",
          priority: cb.status === "live" ? "0.8" : "0.5",
        }));

        const topicPaths: SitemapEntry[] = TOPICS.map((t) => ({
          path: `/topic/${t.slug}`,
          changefreq: "monthly",
          priority: "0.7",
        }));

        const entries = [...staticPaths, ...codebookPaths, ...sourcePaths, ...topicPaths];

        const urls = entries
          .map((e) =>
            [
              `  <url>`,
              `    <loc>${BASE_URL}${e.path}</loc>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n"),
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