import { createFileRoute, Link } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useCases, loadNote, isInline, type CaseRecord } from "@/lib/casebook";
import { Scale, Plus, ChevronRight, PenLine } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/cases/")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: CasesIndex,
  head: () => ({
    meta: [
      { title: "Your cases · Self-Law" },
      {
        name: "description",
        content:
          "Build a case from the law itself: tag your margin notes to a case and they assemble into a citation-backed draft you arrange yourself. Your words, on the record.",
      },
      { property: "og:title", content: "Your cases · Self-Law" },
      { property: "og:description", content: "Assemble citation-backed drafts from your own margin notes." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/cases" }],
  }),
});

function lastTouched(c: CaseRecord): number {
  let t = c.createdAt;
  for (const item of c.items) {
    const u = isInline(item) ? item.updatedAt : loadNote(item)?.updatedAt ?? 0;
    if (u > t) t = u;
  }
  return t;
}

function CasesIndex() {
  const { sources } = Route.useLoaderData();
  const cb = useCases();
  const [newName, setNewName] = useState("");
  const cases = cb.list();

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <header className="mb-8">
        <div className="citation-tag inline-flex items-center gap-2 text-terracotta">
          <Scale className="h-3.5 w-3.5" /> The casebook
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Your cases</h1>
        <p className="mt-3 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
          A case is a folder for your own writing. As you read the law, jot a margin note and type{" "}
          <span className="font-mono text-foreground/80">@</span> to file it here — the citation comes along
          automatically. Back here, drag those notes into the order that reads right: a citation-backed rough draft,
          in your words. <span className="text-foreground/70">Not legal advice — your argument, with the law to back it.</span>
        </p>
      </header>

      {/* create */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) {
            cb.create(newName);
            setNewName("");
          }
        }}
        className="mb-8 flex items-center gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name a case — e.g. “Security deposit — 30 day rule”"
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 font-display text-[15px] outline-none focus:border-ochre"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 font-display text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> New case
        </button>
      </form>

      {/* list */}
      {!cb.hydrated ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <PenLine className="mx-auto h-6 w-6 text-ochre" />
          <p className="mt-3 font-display text-lg font-semibold">No cases yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Open any section of the law, jot a note in the margin, and type <span className="font-mono">@</span> to start
            your first case. Or name one above and start filing notes into it.
          </p>
          <Link to="/code" className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted/60">
            Start reading the law <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => {
            const cites = new Set(c.items.flatMap((it) => (isInline(it) ? it.cites.map((x) => x.identifier) : [it.identifier]))).size;
            const touched = lastTouched(c);
            return (
              <li key={c.id}>
                <Link
                  to="/cases/$id"
                  params={{ id: c.id }}
                  className="group flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ochre/15 text-ochre">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-lg font-semibold leading-tight">{c.name}</div>
                    <div className="mt-0.5 font-mono text-[12px] uppercase tracking-wide text-muted-foreground">
                      {c.items.length} note{c.items.length === 1 ? "" : "s"} · {cites} citation{cites === 1 ? "" : "s"}
                      {touched ? <> · updated {new Date(touched).toLocaleDateString()}</> : null}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ResearchShell>
  );
}
