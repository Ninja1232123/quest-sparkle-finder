import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { getEmbeddingStatus, runEmbeddingBatch } from "@/lib/embeddings.functions";

export const Route = createFileRoute("/admin/embeddings")({
  component: EmbeddingsAdmin,
});

function EmbeddingsAdmin() {
  const fetchStatus = useServerFn(getEmbeddingStatus);
  const runBatchFn = useServerFn(runEmbeddingBatch);
  const [status, setStatus] = useState({ total: 0, embedded: 0, pending: 0 });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(100);
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false);

  useEffect(() => {
    fetchStatus().then(setStatus).catch((err) => {
      setLog((prev) => [`Error loading status: ${err instanceof Error ? err.message : String(err)}`, ...prev]);
    });
  }, [fetchStatus]);

  const pct = status.total > 0 ? Math.round((status.embedded / status.total) * 100) : 0;

  async function runBatch(continueAuto = false) {
    setRunning(true);
    try {
      const result = await runBatchFn({ data: { batch_size: batchSize } });
      const next = await fetchStatus();
      setStatus(next);
      const msg = result.error
        ? `Error: ${result.error}`
        : `Processed ${result.processed} — ${next.embedded}/${next.total} embedded`;
      setLog((prev) => [new Date().toLocaleTimeString() + " " + msg, ...prev.slice(0, 49)]);

      // If auto-run is enabled and there's still work to do, queue another batch.
      if (!result.error && result.processed > 0 && next.pending > 0 && continueAuto && autoRunRef.current) {
        setTimeout(() => runBatch(true), 200);
      } else {
        autoRunRef.current = false;
        setAutoRun(false);
        setRunning(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((prev) => [new Date().toLocaleTimeString() + " Error: " + msg, ...prev.slice(0, 49)]);
      autoRunRef.current = false;
      setAutoRun(false);
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">admin · semantic search</div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Embedding backfill</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generates vector embeddings for every document in the corpus. Once the backfill is
          complete, all searches automatically use hybrid FTS + semantic scoring.
        </p>

        {/* Progress */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-4xl font-bold tabular-nums">{pct}%</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {status.embedded.toLocaleString()} of {status.total.toLocaleString()} documents embedded
              </div>
            </div>
            {status.pending > 0 && (
              <div className="text-right text-sm text-muted-foreground">
                {status.pending.toLocaleString()} remaining
              </div>
            )}
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        {status.pending > 0 && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground">Batch size</label>
              <input
                type="number"
                min={1}
                max={200}
                value={batchSize}
                disabled={running}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(200, Number(e.target.value))))}
                className="w-20 rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { autoRunRef.current = false; setAutoRun(false); runBatch(false); }}
                disabled={running}
                className="rounded-lg bg-foreground px-4 py-2 text-sm text-background transition-opacity disabled:opacity-50"
              >
                {running && !autoRun ? "Running…" : "Run one batch"}
              </button>
              <button
                onClick={() => { autoRunRef.current = true; setAutoRun(true); runBatch(true); }}
                disabled={running}
                className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent transition-opacity disabled:opacity-50 hover:bg-accent/20"
              >
                {running && autoRun ? `Running… (${status.pending.toLocaleString()} left)` : "Run all batches"}
              </button>
              {running && autoRun && (
                <button
                  onClick={() => { autoRunRef.current = false; setAutoRun(false); }}
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  Stop after this batch
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Each batch costs one API call. "Run all batches" loops automatically — safe to stop
              and resume at any time.
            </p>
          </div>
        )}

        {status.pending === 0 && status.total > 0 && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-700 dark:text-green-400">
            All documents are embedded. Hybrid search is fully active.
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="mt-6">
            <div className="citation-tag text-muted-foreground mb-2">Log</div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
              {log.map((line, i) => (
                <div key={i} className="text-muted-foreground">{line}</div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-xs text-muted-foreground space-y-1">
          <p>
            Requires <code className="font-mono">LOVABLE_API_KEY</code> in your environment.
            Model: <code className="font-mono">{typeof process !== "undefined" ? (process.env.EMBEDDING_MODEL ?? "text-embedding-3-small") : "text-embedding-3-small"}</code>.
          </p>
          <p>
            To switch to <code className="font-mono">voyage-law-2</code> (1024 dims): set{" "}
            <code className="font-mono">EMBEDDING_MODEL=voyage-law-2</code>, recreate the{" "}
            <code className="font-mono">embedding</code> column as{" "}
            <code className="font-mono">vector(1024)</code> and update the{" "}
            <code className="font-mono">search_hybrid</code> function signature, then re-run backfill.
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
