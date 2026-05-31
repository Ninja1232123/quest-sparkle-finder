import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listSources } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useCases, loadNote, type CaseItemRef, type NoteRecord } from "@/lib/casebook";
import { ArrowLeft, Scale, GripVertical, Trash2, Download, Printer, ExternalLink, PenLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/cases/$id")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: CaseFile,
  head: () => ({ meta: [{ title: "Case file · Marginalia" }] }),
});

type Block = { ref: CaseItemRef; note: NoteRecord };

function slug(s: string) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "case").slice(0, 60);
}

function CaseFile() {
  const { sources } = Route.useLoaderData();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const cb = useCases();
  const c = cb.get(id);

  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => { if (c) setNameDraft(c.name); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve each ref to its note; drop refs whose note was deleted in the reader.
  const blocks: Block[] = useMemo(() => {
    if (!c) return [];
    const out: Block[] = [];
    for (const ref of c.items) {
      const note = loadNote(ref);
      if (note) out.push({ ref, note });
    }
    return out;
  }, [c]);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function drop(target: number) {
    if (dragIdx == null || !c || dragIdx === target) { setDragIdx(null); setOverIdx(null); return; }
    const items = [...c.items];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(target, 0, moved);
    cb.reorder(id, items);
    setDragIdx(null);
    setOverIdx(null);
  }

  function exportMd() {
    if (!c) return;
    const lines = [`# ${c.name}`, "", "_My own notes, with the law I cited. Not legal advice._", ""];
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.note.text}`);
      lines.push(`   — ${b.note.cite.sectionLabel} ${b.note.cite.heading} (${b.note.cite.identifier})`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(c.name)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function del() {
    if (typeof window !== "undefined" && window.confirm("Delete this case? Your margin notes stay; only this folder and its ordering go.")) {
      cb.remove(id);
      navigate({ to: "/cases" });
    }
  }

  if (cb.hydrated && !c) {
    return (
      <ResearchShell sources={sources} centerMaxWidth="max-w-3xl">
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl">Case not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or it lives in another browser.</p>
          <Link to="/cases" className="mt-6 inline-block underline">Back to your cases</Link>
        </div>
      </ResearchShell>
    );
  }

  const totalCites = c ? new Set(c.items.map((i) => i.identifier)).size : 0;

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-4xl">
      <Link to="/cases" className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> The casebook
      </Link>

      {/* title + actions */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div className="min-w-0 flex-1">
          <div className="citation-tag inline-flex items-center gap-1.5 text-terracotta">
            <Scale className="h-3.5 w-3.5" /> Working file
          </div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => cb.rename(id, nameDraft)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Untitled case"
            className="mt-1 w-full border-0 bg-transparent font-display text-3xl font-semibold tracking-tight outline-none md:text-4xl"
          />
          <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {blocks.length} note{blocks.length === 1 ? "" : "s"} · {totalCites} citation{totalCites === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={exportMd} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-foreground/40" aria-label="Download as Markdown">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-foreground/40" aria-label="Print">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button type="button" onClick={del} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-destructive/80 hover:border-destructive/50 hover:text-destructive" aria-label="Delete case">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* the assembled draft */}
      {!cb.hydrated ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}
        </div>
      ) : blocks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <PenLine className="mx-auto h-6 w-6 text-ochre" />
          <p className="mt-3 font-display text-lg font-semibold">Nothing filed here yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Open the law, write a note in the margin, and type <span className="font-mono">@{c?.name}</span> to file it
            into this case. It'll show up here with its citation, ready to arrange.
          </p>
          <Link to="/code" className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted/60">
            Go read the law
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Drag to set the order it should read in ↓
          </p>
          <ol className="mt-3 space-y-3">
            {blocks.map((b, i) => (
              <li
                key={`${b.ref.identifier}#${b.ref.paraIndex}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDrop={() => drop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`group flex gap-3 rounded-2xl border bg-card p-4 transition ${
                  dragIdx === i ? "opacity-50" : ""
                } ${overIdx === i && dragIdx !== null && dragIdx !== i ? "border-ochre ring-1 ring-ochre/40" : "border-border"}`}
              >
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <span className="cursor-grab text-muted-foreground/50 active:cursor-grabbing" title="Drag to reorder">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap font-hand text-[21px] leading-snug text-foreground">{b.note.text}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border/50 pt-2">
                    <Link
                      to="/code/$"
                      params={{ _splat: b.ref.identifier.replace(/^\//, "") }}
                      search={{ q: undefined }}
                      hash={`para-${b.ref.paraIndex}`}
                      className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-terracotta hover:underline"
                    >
                      <span className="truncate">{b.note.cite.sectionLabel} · {b.note.cite.heading}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => cb.removeItem(id, b.ref)}
                      className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                    >
                      remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* the framing — non-negotiable */}
      <div className="mt-10 rounded-2xl border border-border/60 bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        <span className="font-display font-semibold text-foreground">This is your work product.</span> These are your
        own words and the law you chose to cite — a rough draft to help you say what you believe and back it up, or to
        research. It is <span className="font-semibold">not legal advice and not an interpretation</span> by Marginalia.
        Whether an argument has merit is for a court to decide. Everything here is saved only on this device.
      </div>
    </ResearchShell>
  );
}
