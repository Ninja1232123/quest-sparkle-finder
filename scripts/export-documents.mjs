#!/usr/bin/env node
// Stream every row out of public.documents into a local NDJSON file via the
// marketing-agent API. Keyset-paginated (no offset), resumable on crash.
//
// Usage:
//   AGENT_KEY=xxx node scripts/export-documents.mjs <out.ndjson> \
//     [--source usc] [--limit 1000] [--with-embedding] \
//     [--fields id,identifier,body_text] [--after <id>] \
//     [--base https://self-law.org]
//
// Example — dump everything including embeddings:
//   AGENT_KEY=$KEY node scripts/export-documents.mjs ./docs.ndjson --with-embedding
//
// Resume after a crash: the script prints the last id every batch; pass it
// back via --after <id> to continue without re-downloading.

import fs from "node:fs";

const [,, outFile, ...rest] = process.argv;
if (!outFile) {
  console.error("usage: AGENT_KEY=... node scripts/export-documents.mjs <out.ndjson> [--source X] [--limit N] [--with-embedding] [--fields a,b] [--after ID] [--base URL]");
  process.exit(1);
}

let source = null, after = null, limit = 1000, withEmbedding = false, fields = null;
let base = "https://self-law.org";
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "--source") source = rest[++i];
  else if (a === "--after") after = rest[++i];
  else if (a === "--limit") limit = parseInt(rest[++i], 10) || 1000;
  else if (a === "--with-embedding") withEmbedding = true;
  else if (a === "--fields") fields = rest[++i];
  else if (a === "--base") base = rest[++i];
}

const key = process.env.AGENT_KEY;
if (!key) { console.error("Missing AGENT_KEY env var."); process.exit(1); }

const endpoint = `${base.replace(/\/$/, "")}/api/public/v1/export-documents`;
const out = fs.createWriteStream(outFile, { flags: after ? "a" : "w" });

async function fetchPage(cursor) {
  const u = new URL(endpoint);
  u.searchParams.set("limit", String(limit));
  if (source) u.searchParams.set("source", source);
  if (withEmbedding) u.searchParams.set("with_embedding", "1");
  if (fields) u.searchParams.set("fields", fields);
  if (cursor) u.searchParams.set("after", cursor);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(u, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
      return await res.json();
    } catch (e) {
      if (attempt === 5) {
        console.error(`\nfailed after 5 tries at after=${cursor ?? "(start)"}: ${e.message}`);
        console.error(`Resume with: --after ${cursor ?? ""}`);
        process.exit(1);
      }
      const wait = 1000 * attempt;
      process.stderr.write(`\n  retry ${attempt} in ${wait}ms (${e.message})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

let cursor = after;
let total = 0;
const t0 = Date.now();

while (true) {
  const page = await fetchPage(cursor);
  const rows = page.rows ?? [];
  for (const r of rows) out.write(JSON.stringify(r) + "\n");
  total += rows.length;
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  process.stdout.write(`\r rows ${total}  after=${page.next_after ?? "(done)"}  ${secs}s`);
  if (!page.next_after) break;
  cursor = page.next_after;
}

out.end();
console.log(`\nDone. wrote ${total} rows -> ${outFile}`);