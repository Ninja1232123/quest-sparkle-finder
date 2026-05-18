import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, requireAgentAuth, supabaseAdmin } from "@/lib/agent-api.server";

// Streaming NDJSON ingest from Cloud Storage into public.documents.
//
// POST /api/public/v1/ingest-ndjson
// Body: {
//   bucket: string,            // e.g. "fedregister"
//   path: string,              // object key inside the bucket
//   source_code?: string,      // fallback when a row omits it
//   start_byte?: number,       // resume offset, defaults to 0
//   max_seconds?: number,      // wall-clock budget per call (default 22)
//   batch_size?: number,       // rows per insert (default 500)
// }
//
// Returns: { inserted, scanned, next_byte, done, total_bytes, last_identifier }
// The caller is expected to loop, feeding next_byte back as start_byte, until done.

type DocRow = {
  source_code?: string | null;
  identifier?: string | null;
  parent_label?: string | null;
  section_label?: string | null;
  heading?: string | null;
  body_text?: string | null;
  body_md?: string | null;
  hierarchy?: unknown;
  sort_key?: string | null;
  word_count?: number | null;
};

type Body = {
  bucket?: string;
  path?: string;
  source_code?: string;
  start_byte?: number;
  max_seconds?: number;
  batch_size?: number;
};

const COLS = [
  "source_code", "identifier", "parent_label", "section_label",
  "heading", "body_text", "body_md", "hierarchy", "sort_key", "word_count",
] as const;

function normalize(row: DocRow, fallbackSource: string | undefined) {
  const source_code = (row.source_code ?? fallbackSource ?? "").toString().trim();
  const identifier = (row.identifier ?? "").toString().trim();
  if (!source_code || !identifier) return null;
  const out: Record<string, unknown> = { source_code, identifier };
  for (const k of COLS) {
    if (k === "source_code" || k === "identifier") continue;
    const v = (row as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const Route = createFileRoute("/api/public/v1/ingest-ndjson")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireAgentAuth(request);
        if (unauthorized) return unauthorized;

        let body: Body;
        try { body = await request.json() as Body; }
        catch { return jsonResponse({ error: "invalid json body" }, { status: 400 }); }

        const bucket = (body.bucket ?? "").trim();
        const path = (body.path ?? "").trim();
        if (!bucket || !path) return jsonResponse({ error: "bucket and path required" }, { status: 400 });

        const startByte = Math.max(0, Number(body.start_byte ?? 0) | 0);
        const maxSeconds = Math.min(Math.max(Number(body.max_seconds ?? 22), 5), 25);
        const batchSize = Math.min(Math.max(Number(body.batch_size ?? 500), 50), 2000);
        const fallbackSource = body.source_code?.trim() || undefined;

        // Signed URL so we can stream with a Range header (Storage SDK download
        // doesn't expose Range natively).
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(bucket).createSignedUrl(path, 60 * 60);
        if (signErr || !signed?.signedUrl) {
          return jsonResponse({ error: signErr?.message ?? "could not sign url" }, { status: 404 });
        }

        const upstream = await fetch(signed.signedUrl, {
          headers: { Range: `bytes=${startByte}-` },
        });
        if (!upstream.ok && upstream.status !== 206 && upstream.status !== 200) {
          return jsonResponse({ error: `storage fetch failed: ${upstream.status}` }, { status: 502 });
        }
        // Content-Range: "bytes 0-99/12345" — last number is total size.
        const cr = upstream.headers.get("content-range");
        let totalBytes: number | null = null;
        if (cr) {
          const m = cr.match(/\/(\d+)\s*$/);
          if (m) totalBytes = parseInt(m[1], 10);
        } else {
          const cl = upstream.headers.get("content-length");
          if (cl) totalBytes = startByte + parseInt(cl, 10);
        }

        if (!upstream.body) return jsonResponse({ error: "no response body" }, { status: 502 });

        const deadline = Date.now() + maxSeconds * 1000;
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let tail = "";          // partial last line
        let bytesConsumed = 0;  // bytes from this response we've fully committed (whole lines)
        let pendingBytes = 0;   // bytes read but not yet flushed (tail + current batch buffer source)
        let inserted = 0;
        let scanned = 0;
        let lastIdentifier: string | null = null;
        let done = false;

        const batch: Record<string, unknown>[] = [];

        const flush = async () => {
          if (batch.length === 0) return;
          const { error } = await supabaseAdmin
            .from("documents")
            .upsert(batch, { onConflict: "identifier", ignoreDuplicates: true });
          if (error) throw new Error(`insert failed near "${lastIdentifier}": ${error.message}`);
          inserted += batch.length;
          bytesConsumed += pendingBytes;
          pendingBytes = 0;
          batch.length = 0;
        };

        try {
          outer: while (true) {
            if (Date.now() > deadline) break;
            const { value, done: streamDone } = await reader.read();
            if (streamDone) {
              // Process final tail if present and non-empty.
              if (tail.trim()) {
                pendingBytes += new TextEncoder().encode(tail).length;
                const row = safeParse(tail);
                if (row) {
                  const n = normalize(row, fallbackSource);
                  if (n) { batch.push(n); lastIdentifier = String(n.identifier); scanned++; }
                }
                tail = "";
              }
              await flush();
              done = true;
              break;
            }
            const chunkText = decoder.decode(value, { stream: true });
            pendingBytes += value.byteLength;
            const combined = tail + chunkText;
            const lines = combined.split("\n");
            tail = lines.pop() ?? "";  // last item is incomplete (or empty if chunk ended with \n)

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              scanned++;
              const row = safeParse(trimmed);
              if (!row) continue;
              const n = normalize(row, fallbackSource);
              if (!n) continue;
              batch.push(n);
              lastIdentifier = String(n.identifier);
              if (batch.length >= batchSize) {
                await flush();
                if (Date.now() > deadline) break outer;
              }
            }
          }
          // Flush any remaining whole-line rows before returning (keeps next call aligned).
          if (batch.length > 0) await flush();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Cancel upstream so we don't keep the socket open.
          try { await reader.cancel(); } catch { /* noop */ }
          return jsonResponse({
            error: msg,
            inserted, scanned,
            next_byte: startByte + bytesConsumed,
            last_identifier: lastIdentifier,
          }, { status: 500 });
        }

        try { await reader.cancel(); } catch { /* noop */ }

        return jsonResponse({
          inserted,
          scanned,
          next_byte: startByte + bytesConsumed,
          total_bytes: totalBytes,
          done,
          last_identifier: lastIdentifier,
        });
      },
    },
  },
});

function safeParse(line: string): DocRow | null {
  try { return JSON.parse(line) as DocRow; }
  catch { return null; }
}