#!/usr/bin/env node
// Stream a local NDJSON file into public.documents using the service-role key.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/ingest-local-ndjson.mjs <file.ndjson> <source_code> [--start-line N] [--batch 500]
//
// Example:
//   node scripts/ingest-local-ndjson.mjs ./register-part-03.ndjson register
//
// Resumable: prints the last line number processed every batch. Re-run with
//   --start-line <N> to skip ahead after a crash.

import fs from "node:fs";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

const [,, file, fallbackSource, ...rest] = process.argv;
if (!file || !fallbackSource) {
  console.error("usage: node ingest-local-ndjson.mjs <file.ndjson> <source_code> [--start-line N] [--batch 500]");
  process.exit(1);
}

let startLine = 0;
let batchSize = 500;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--start-line") startLine = parseInt(rest[++i], 10) || 0;
  else if (rest[i] === "--batch") batchSize = parseInt(rest[++i], 10) || 500;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const COLS = ["source_code","identifier","parent_label","section_label","heading","body_text","body_md","hierarchy","sort_key","word_count"];

function normalize(row) {
  const source_code = (row.source_code ?? fallbackSource ?? "").toString().trim();
  const identifier = (row.identifier ?? "").toString().trim().replace(/^\/+/, "");
  if (!source_code || !identifier) return null;
  const out = { source_code, identifier };
  for (const k of COLS) {
    if (k === "source_code" || k === "identifier") continue;
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

async function flush(batch, lineNo) {
  if (!batch.length) return;
  const { error } = await supabase
    .from("documents")
    .upsert(batch, { onConflict: "identifier", ignoreDuplicates: true });
  if (error) {
    console.error(`\n[line ${lineNo}] insert error:`, error.message);
    console.error(`Resume with: --start-line ${lineNo - batch.length}`);
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: fs.createReadStream(file, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let batch = [];
let lineNo = 0;
let inserted = 0;
let skipped = 0;
const t0 = Date.now();

for await (const line of rl) {
  lineNo++;
  if (lineNo <= startLine) continue;
  const trimmed = line.trim();
  if (!trimmed) continue;
  let row;
  try { row = JSON.parse(trimmed); }
  catch { skipped++; continue; }
  const n = normalize(row);
  if (!n) { skipped++; continue; }
  batch.push(n);
  if (batch.length >= batchSize) {
    await flush(batch, lineNo);
    inserted += batch.length;
    batch = [];
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    process.stdout.write(`\r line ${lineNo}  inserted ${inserted}  skipped ${skipped}  ${secs}s`);
  }
}
await flush(batch, lineNo);
inserted += batch.length;
console.log(`\nDone. line=${lineNo} inserted=${inserted} skipped=${skipped}`);