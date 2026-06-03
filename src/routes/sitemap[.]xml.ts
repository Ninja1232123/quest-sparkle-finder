import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listSources, FIREHOSE_SOURCES } from "@/lib/documents.functions";

const BASE_URL = "https://self-law.org";
// MUST match PAGE_SIZE in sitemap-docs.xml.ts — used here to compute how many
// document pages each source needs.
const PAGE_SIZE = 5000;

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The sitemap INDEX. A single sitemap is capped at 50k URLs, and the corpus is
// far larger, so /sitemap.xml is a <sitemapindex> pointing at child sitemaps:
//   /sitemap-pages.xml                       — static + codebook + topic pages
//   /sitemap-docs.xml?source=<s>&page=<n>    — one page of documents per source
// Firehose sources (bill, register) are excluded for now: they each carry
// hundreds of thousands of time-series rows that would swamp the crawl budget;
// they can be added as their own children later if we want them indexed.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { sources } = await listSources();

        const children: string[] = [
          `${BASE_URL}/sitemap-pages.xml`,
          `${BASE_URL}/sitemap-outcomes.xml`,
          `${BASE_URL}/sitemap-opinions.xml`,
        ];
        for (const s of sources) {
          if (FIREHOSE_SOURCES.has(s.code)) continue;
          const pages = Math.max(1, Math.ceil(s.count / PAGE_SIZE));
          for (let p = 0; p < pages; p++) {
            children.push(`${BASE_URL}/sitemap-docs.xml?source=${encodeURIComponent(s.code)}&page=${p}`);
          }
        }

        const body = children
          .map((loc) => `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n  </sitemap>`)
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;

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
