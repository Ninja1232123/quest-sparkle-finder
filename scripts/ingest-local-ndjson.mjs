#!/usr/bin/env node
// Stream a local NDJSON file into public.documents via the marketing-agent API.
// No service-role key needed — uses MARKETING_AGENT_API_KEY (bearer token).
//
// Usage:
//   AGENT_KEY=xxxxx node scripts/ingest-local-ndjson.mjs <file.ndjson> <source_code> \
//     [--start-line N] [--batch 500] [--base https://self-law.org]
//
// Example:
//   AGENT_KEY=$KEY node scripts/ingest-local-ndjson.mjs ./register-part-03.ndjson register
//
// Resumable: on any error the script prints `--start-line N` to resume from.

import fs from "node:fs";
import readline from "node:readline";

const [,, file, fallbackSource, ...rest] = process.argv;
if (!file || !fallbackSource) {
  console.error("usage: AGENT_KEY=... node ingest-local-ndjson.mjs <file.ndjson> <source_code> [--start-line N] [--batch 500] [--base URL]");
  process.exit(1);
}

let startLine = 0;
let endLine = Infinity;
let batchSize = 500;
let base = "https://self-law.org";
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--start-line") startLine = parseInt(rest[++i], 10) || 0;
  else if (rest[i] === "--end-line") endLine = parseInt(rest[++i], 10) || Infinity;
  else if (rest[i] === "--batch") batchSize = parseInt(rest[++i], 10) || 500;
  else if (rest[i] === "--base") base = rest[++i];
}

const key = process.env.AGENT_KEY;
if (!key) {
  console.error("Missing AGENT_KEY env var (the MARKETING_AGENT_API_KEY value).");
  process.exit(1);
}

const endpoint = `${base.replace(/\/$/, "")}/api/public/v1/ingest-batch`;

const MAX_ATTEMPTS = 12;
async function postBatch(rows, firstLine, lastLine) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ source_code: fallbackSource, rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error ?? "unknown"}`);
      return json;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`\n[lines ${firstLine}-${lastLine}] failed after ${MAX_ATTEMPTS} tries: ${e.message}`);
        console.error(`Resume with: --start-line ${firstLine - 1}`);
        process.exit(1);
      }
      // Exponential backoff capped at 30s — under parallel-worker DB load,
      // statement-timeout failures can take >10s to clear.
      const wait = Math.min(30000, 1000 * 2 ** (attempt - 1));
      process.stdout.write(`\n  retry ${attempt} in ${wait}ms (${e.message})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const rl = readline.createInterface({
  input: fs.createReadStream(file, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let batch = [];
let batchFirstLine = 0;
let lineNo = 0;
let inserted = 0;
let skipped = 0;
const t0 = Date.now();

for await (const line of rl) {
  lineNo++;
  if (lineNo <= startLine) continue;
  if (lineNo > endLine) break;
  const trimmed = line.trim();
  if (!trimmed) continue;
  let row;
  try { row = JSON.parse(trimmed); }
  catch { skipped++; continue; }
  if (batch.length === 0) batchFirstLine = lineNo;
  batch.push(row);
  if (batch.length >= batchSize) {
    const res = await postBatch(batch, batchFirstLine, lineNo);
    inserted += res?.inserted ?? 0;
    skipped  += res?.skipped  ?? 0;
    batch = [];
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    process.stdout.write(`\r line ${lineNo}  inserted ${inserted}  skipped ${skipped}  ${secs}s`);
  }
}
if (batch.length) {
  const res = await postBatch(batch, batchFirstLine, lineNo);
  inserted += res?.inserted ?? 0;
  skipped  += res?.skipped  ?? 0;
}
console.log(`\nDone. line=${lineNo} inserted=${inserted} skipped=${skipped}`);