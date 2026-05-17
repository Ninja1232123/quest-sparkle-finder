// Shared helpers for the public marketing-agent API (/api/public/v1/*).
// Bearer-token auth using MARKETING_AGENT_API_KEY. Service-role Supabase
// client; every handler must scope queries explicitly.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

const CANONICAL_ORIGIN = "https://self-law.org";

const SOURCE_CITE: Record<string, (id: string) => string> = {
  usc: (id) => {
    // usc/42/1983 -> 42 U.S.C. § 1983
    const m = id.match(/^usc\/(\d+)\/(.+)$/);
    return m ? `${m[1]} U.S.C. § ${m[2]}` : id;
  },
  cfr: (id) => {
    const m = id.match(/^cfr\/(\d+)\/(.+)$/);
    return m ? `${m[1]} C.F.R. § ${m[2]}` : id;
  },
  ucc: (id) => {
    const m = id.match(/^ucc\/(.+)$/);
    return m ? `U.C.C. § ${m[1]}` : id;
  },
  const: (id) => id.replace(/^const\//, "U.S. Const. "),
};

export function canonicalUrl(identifier: string): string {
  return `${CANONICAL_ORIGIN}/code/${identifier}`;
}

export function formatCitation(source_code: string, identifier: string, section_label: string | null): string {
  const fn = SOURCE_CITE[source_code];
  if (fn) return fn(identifier);
  return section_label ?? identifier;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      ...(init.headers ?? {}),
    },
  });
}

export function requireAgentAuth(request: Request): Response | null {
  const expected = process.env.MARKETING_AGENT_API_KEY;
  if (!expected) {
    return jsonResponse({ error: "Server missing MARKETING_AGENT_API_KEY" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Find the best 1–3 sentence excerpt containing the most query terms.
export function bestExcerpt(body: string, query: string, maxLen = 420): string {
  if (!body) return "";
  const terms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const sentences = body.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  let best = { score: -1, idx: 0 };
  sentences.forEach((s, i) => {
    const lower = s.toLowerCase();
    const score = terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
    if (score > best.score) best = { score, idx: i };
  });
  const start = Math.max(0, best.idx);
  let out = "";
  for (let i = start; i < sentences.length && out.length < maxLen; i++) {
    out += (out ? " " : "") + sentences[i];
  }
  return out.slice(0, maxLen).trim();
}