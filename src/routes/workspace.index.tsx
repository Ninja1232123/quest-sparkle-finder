import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread } from "@/lib/workspace.functions";
import { useAuth } from "@/hooks/use-auth";
import { Plus, MessageSquare, Scale, FileSignature, ScrollText, Search, FileCheck2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceIndex,
});

const PROMPT_SEEDS: { icon: React.ComponentType<{ className?: string }>; label: string; prompt: string }[] = [
  { icon: FileSignature, label: "Draft a motion", prompt: "Draft a motion to dismiss under FRCP 12(b)(6) for failure to state a claim. Include statement of facts, legal standard with citations, and argument sections." },
  { icon: Search, label: "Research a statute", prompt: "Pull 42 U.S.C. § 1983 and walk me through the elements of a civil rights claim against a state actor." },
  { icon: FileCheck2, label: "Cite-check this", prompt: "Cite-check this passage and tell me which citations resolve to the corpus and which don't:\n\n[paste your text here]" },
  { icon: ScrollText, label: "Plain-English a section", prompt: "Find the section of the CFR governing residential lead-paint disclosures and explain it in plain English, with the operative quote." },
];

function WorkspaceIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const [threads, setThreads] = useState<Array<{ id: string; title: string; last_message_at: string }> | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    list().then((t) => setThreads(t as typeof threads)).catch(() => setThreads([]));
  }, [user, loading, list, create, navigate]);

  async function startWith(prompt?: string) {
    const t = await create({ data: prompt ? { title: prompt.slice(0, 60) } : {} });
    if (!t?.id) return;
    navigate({
      to: "/workspace/$threadId",
      params: { threadId: t.id },
      search: prompt ? { q: prompt } : {},
    });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
        <div className="mb-2 text-[10px] tracking-[0.35em]" style={{ color: "rgba(0,0,0,0.5)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
          MARGINALIA · WORKSPACE
        </div>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>
          The research desk.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Ask. Draft. Cite-check. Export. An AI that reads the corpus before it speaks — and shows its work.
          Pair it with your <Link to="/cases" className="underline decoration-dotted underline-offset-2 hover:text-foreground">casebook</Link>{" "}
          and the <Link to="/builder" className="underline decoration-dotted underline-offset-2 hover:text-foreground">document builder</Link> to take it from research to filed.
        </p>

        <button
          type="button"
          onClick={() => startWith()}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
          style={{ background: "#0c1b3d", color: "#fff" }}
        >
          <Plus className="h-4 w-4" /> New blank session
        </button>

        <div className="mt-10">
          <div className="mb-3 text-[10px] tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-mono, 'Special Elite')" }}>
            START FROM A TEMPLATE
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROMPT_SEEDS.map((seed) => (
              <button
                key={seed.label}
                type="button"
                onClick={() => startWith(seed.prompt)}
                className="group flex items-start gap-3 rounded-lg border bg-background/60 p-4 text-left transition-all hover:border-foreground/40 hover:shadow-md"
                style={{ borderColor: "rgba(0,0,0,0.12)" }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                  style={{ background: "rgba(200,162,75,0.18)", color: "#0c1b3d" }}
                >
                  <seed.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium" style={{ fontFamily: "var(--font-serif, 'Cinzel')", fontSize: 14 }}>
                    {seed.label}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {seed.prompt}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to="/cases"
            className="group flex items-start gap-3 rounded-lg border bg-background/60 p-4 transition-all hover:border-foreground/40 hover:shadow-md"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          >
            <Scale className="h-5 w-5 shrink-0 text-foreground/70" />
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ fontFamily: "var(--font-serif, 'Cinzel')", fontSize: 14 }}>Your casebook</div>
              <div className="mt-1 text-xs text-muted-foreground">Margin notes you tagged with <span className="font-mono">@</span>, assembled into citation-backed drafts.</div>
            </div>
          </Link>
          <Link
            to="/builder"
            className="group flex items-start gap-3 rounded-lg border bg-background/60 p-4 transition-all hover:border-foreground/40 hover:shadow-md"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          >
            <FileSignature className="h-5 w-5 shrink-0 text-foreground/70" />
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ fontFamily: "var(--font-serif, 'Cinzel')", fontSize: 14 }}>Pleading builder</div>
              <div className="mt-1 text-xs text-muted-foreground">Court-formatted caption, line numbers, fonts — export to PDF.</div>
            </div>
          </Link>
        </div>

        {threads && threads.length > 0 && (
          <div className="mt-12">
            <div className="mb-3 text-[10px] tracking-[0.3em] text-muted-foreground" style={{ fontFamily: "var(--font-mono, 'Special Elite')" }}>
              RECENT SESSIONS
            </div>
            <ul className="divide-y rounded-lg border bg-background/40" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
              {threads.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    to="/workspace/$threadId"
                    params={{ threadId: t.id }}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-foreground/5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>{t.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {new Date(t.last_message_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}