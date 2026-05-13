import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Loader2, Sparkles, RotateCw } from "lucide-react";

export const Route = createFileRoute("/chambers")({
  component: ChambersPage,
  head: () => ({
    meta: [
      { title: "In Chambers · Marginalia" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Off the record." },
    ],
  }),
});

function ChambersPage() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chambers/generate", { method: "POST" });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        if (res.status === 429) setError("This universe is rate-limited. Try again in a moment.");
        else if (res.status === 402) setError("The simulator is out of quarters. Add credits to keep spinning.");
        else setError(data.error ?? "The signal cut out. Try again.");
      } else {
        setText(data.text ?? "");
        setCount((n) => n + 1);
      }
    } catch {
      setError("The signal cut out. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void generate(); }, []);

  const [jurisdiction, ...bodyLines] = (text ?? "").split("\n");
  const body = bodyLines.join("\n").trim();

  return (
    <div className="min-h-screen bg-[var(--ink)] text-background">
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-background/40">
          ⬆ ⬆ ⬇ ⬇ ⬅ ➡ ⬅ ➡ B A
        </div>
        <h1 className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
          The <span className="italic text-[var(--ochre)]">multiverse</span>.
        </h1>
        <p className="mt-8 max-w-lg font-display text-xl italic leading-relaxed text-background/70">
          Field reports from jurisdictions that don't exist. None of this is real. None of this is advice. All of it is a coping mechanism.
        </p>

        <div className="mt-12 rounded-2xl border border-background/15 bg-background/[0.03] p-7 paper-grain min-h-[260px] relative">
          {loading && !text && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-background/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                tuning the dial…
              </div>
            </div>
          )}
          {error && (
            <div className="text-sm text-[var(--ochre)]">{error}</div>
          )}
          {text && !error && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/40">
                transmission #{String(count).padStart(3, "0")}
              </div>
              <div className="mt-2 font-display text-lg font-semibold tracking-tight text-[var(--ochre)]">
                {jurisdiction}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-background/85">
                {body}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ochre)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {text ? "Spin another universe" : "Generate"}
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-4 py-2 text-xs text-background/70 hover:border-background/60 hover:text-background disabled:opacity-50"
          >
            <RotateCw className="h-3 w-3" /> reroll
          </button>
        </div>

        <p className="mt-10 max-w-lg font-mono text-[11px] uppercase tracking-wider text-background/40">
          rule 1 — none of this is real. rule 2 — cite it anyway. rule 3 — see rule 1.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            to="/"
            className="rounded-full border border-background/20 px-5 py-2 text-sm text-background/80 hover:border-background/60 hover:text-background"
          >
            ← back to the record
          </Link>
          <Link
            to="/forum"
            className="rounded-full bg-[var(--ochre)] px-5 py-2 text-sm font-semibold text-[var(--ink)] hover:opacity-90"
          >
            take it to The Floor
          </Link>
        </div>
      </section>
      <div className="border-t border-background/10">
        <SiteFooter />
      </div>
    </div>
  );
}
