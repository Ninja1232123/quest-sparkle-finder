import { createFileRoute } from "@tanstack/react-router";

// OpenAPI 3.1 schema for the marketing-agent API. Paste the URL of this
// endpoint into any tool that consumes OpenAPI (Ollama via ollama-mcp,
// LangChain OpenAPIToolkit, Custom GPTs, Claude tool config, etc.).
export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      GET: async () => {
        const spec = {
          openapi: "3.1.0",
          info: {
            title: "Marginalia Legal Corpus API",
            version: "1.0.0",
            description:
              "Read-only search over US federal legal sources (USC, CFR, UCC, Constitution, etc.). " +
              "Use `search_law` to find relevant sections, then `get_law_document` to fetch the full text.",
          },
          servers: [{ url: "https://self-law.org" }],
          components: {
            securitySchemes: {
              bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
            },
            schemas: {
              SearchHit: {
                type: "object",
                properties: {
                  identifier: { type: "string", description: "Canonical id, e.g. 'usc/42/1983'." },
                  source: { type: "string", description: "Source code: usc, cfr, ucc, const, fedreg, etc." },
                  heading: { type: "string", nullable: true },
                  section_label: { type: "string", nullable: true },
                  parent_label: { type: "string", nullable: true },
                  citation: { type: "string", description: "Human-readable citation, e.g. '42 U.S.C. § 1983'." },
                  url: { type: "string", format: "uri" },
                  snippet: { type: "string" },
                  rank: { type: "number" },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
          paths: {
            "/api/public/v1/search": {
              get: {
                operationId: "search_law",
                summary: "Search the legal corpus by keyword or natural language.",
                parameters: [
                  { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 200 }, description: "Search query." },
                  { name: "source", in: "query", required: false, schema: { type: "string" }, description: "Optional source filter (e.g. 'usc', 'cfr')." },
                  { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
                ],
                responses: {
                  "200": {
                    description: "Ranked results.",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            query: { type: "string" },
                            source: { type: "string", nullable: true },
                            count: { type: "integer" },
                            results: { type: "array", items: { $ref: "#/components/schemas/SearchHit" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "/api/public/v1/doc/{identifier}": {
              get: {
                operationId: "get_law_document",
                summary: "Fetch the full text of one document by its canonical identifier.",
                parameters: [
                  { name: "identifier", in: "path", required: true, schema: { type: "string" }, description: "e.g. 'usc/42/1983' or 'cfr/29/1910.95'." },
                ],
                responses: {
                  "200": {
                    description: "Document with body text and outgoing citations.",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            identifier: { type: "string" },
                            source: { type: "string" },
                            heading: { type: "string", nullable: true },
                            section_label: { type: "string", nullable: true },
                            citation: { type: "string" },
                            url: { type: "string", format: "uri" },
                            word_count: { type: "integer", nullable: true },
                            body_text: { type: "string" },
                            body_md: { type: "string", nullable: true },
                            citations: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  identifier: { type: "string" },
                                  heading: { type: "string", nullable: true },
                                  url: { type: "string", format: "uri" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  "404": { description: "Not found." },
                },
              },
            },
          },
        };
        return new Response(JSON.stringify(spec, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});