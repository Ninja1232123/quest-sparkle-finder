import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listSources, getDocument } from "@/lib/documents.functions";
import { ResearchShell } from "@/components/marginalia/ResearchShell";
import { useCases, loadNote, isInline, type CaseItem, type CaseItemRef, type NoteCite } from "@/lib/casebook";
import { segmentBody, citationSpans, operativeParagraphs, type LegalPara } from "@/lib/legal-structure";
import { ArrowLeft, Scale, GripVertical, Trash2, Download, Printer, ExternalLink, PenLine, BookOpen, X, Layers } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { seedThreadFromHandoff } from "@/lib/workspace.functions";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/cases/$id")({
  loader: async () => {
    const { sources } = await listSources();
    return { sources };
  },
  component: CaseFile,
  head: () => ({ meta: [{ title: "Case file · Self-Law" }] }),
});

// A point on the page: either a margin note (one citation) or an inline
// synthesis note authored on the Compare shelf (several citations).
type ResolvedBlock = { key: string; item: CaseItem; text: string; cites: NoteCite[]; editable: boolean };

function slug(s: string) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "case").slice(0, 60);
}

// The reading-room panel: pull a cited section's full text up alongside the
// draft so you can re-read the exact clause while you polish, without losing
// your place. Highlights the paragraph the note was written on.
function CitationPanel({ pinned, onClose }: { pinned: CaseItemRef; onClose: () => void }) {
  const [st, setSt] = useState<{ loading: boolean; err?: boolean; label?: string; heading?: string; body?: string; paras?: LegalPara[] }>({ loading: true });
  const hlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setSt({ loading: true });
    getDocument({ data: { identifier: pinned.identifier } })
      .then((res) => {
        if (!alive) return;
        const doc = res.document;
        if (!doc) { setSt({ loading: false, err: true }); return; }
        const body = doc.body_text ?? "";
        const paras = operativeParagraphs(body, segmentBody(doc.source_code ?? "", body), citationSpans(res.citations ?? []));
        setSt({ loading: false, label: doc.section_label ?? "", heading: doc.heading ?? "", body, paras });
      })
      .catch(() => { if (alive) setSt({ loading: false, err: true }); });
    return () => { alive = false; };
  }, [pinned.identifier]);

  useEffect(() => {
    if (!st.loading && hlRef.current) hlRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [st.loading, pinned.paraIndex]);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="citation-tag inline-flex items-center gap-1.5 text-terracotta"><BookOpen className="h-3.5 w-3.5" /> Reading</div>
          {st.label ? <div className="mt-1 font-mono text-[11px] text-muted-foreground">{st.label}</div> : null}
          {st.heading ? <div className="font-display text-sm font-semibold leading-snug">{st.heading}</div> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {st.loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 animate-pulse rounded bg-muted/60" />)}</div>
      ) : st.err ? (
        <p className="text-sm text-muted-foreground">Couldn't load that section here. <Link to="/code/$" params={{ _splat: pinned.identifier.replace(/^\//, "") }} search={{ q: undefined }} className="underline">Open it in the reader →</Link></p>
      ) : (
        <>
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 font-serif text-[0.92rem] leading-relaxed text-foreground/85">
            {(st.paras ?? []).map((p, i) => {
              const text = (st.body ?? "").slice(p.start, p.end).trim();
              const hot = i === pinned.paraIndex;
              return (
                <div
                  key={i}
                  ref={hot ? hlRef : undefined}
                  className={hot ? "rounded-md border-l-2 border-ochre bg-ochre/10 px-2 py-1" : ""}
                >
                  {p.label ? <span className="mr-1.5 font-mono text-[11px] text-foreground/45">{p.label}</span> : null}
                  {text}
                </div>
              );
            })}
          </div>
          <Link
            to="/code/$"
            params={{ _splat: pinned.identifier.replace(/^\//, "") }}
            search={{ q: undefined }}
            hash={`para-${pinned.paraIndex}`}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-terracotta hover:underline"
          >
            Open full section <ExternalLink className="h-3 w-3" />
          </Link>
        </>
      )}
    </div>
  );
}

function CaseFile() {
  const { sources } = Route.useLoaderData();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const cb = useCases();
  const c = cb.get(id);

  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => { if (c) setNameDraft(c.name); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pinned, setPinned] = useState<CaseItemRef | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // inline-note id being edited
  const [editDraft, setEditDraft] = useState("");

  // The reading room is a side rail at xl+, where there's room beside the sheet;
  // below that it opens as a drawer over the page. Track which so we mount the
  // CitationPanel in exactly one place (no double fetch).
  const [isWide, setIsWide] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setIsWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Resolve each item to a renderable point; drop margin refs whose note was
  // deleted in the reader. Inline (Compare) notes carry their own text + cites.
  const blocks: ResolvedBlock[] = useMemo(() => {
    if (!c) return [];
    const out: ResolvedBlock[] = [];
    for (const item of c.items) {
      if (isInline(item)) {
        out.push({ key: `n:${item.id}`, item, text: item.text, cites: item.cites, editable: true });
      } else {
        const note = loadNote(item);
        if (note) out.push({ key: `m:${item.identifier}#${item.paraIndex}`, item, text: note.text, cites: [note.cite], editable: false });
      }
    }
    return out;
  }, [c]);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function drop(target: number) {
    if (dragIdx == null || dragIdx === target) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...blocks];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(target, 0, moved);
    cb.reorder(id, arr.map((b) => b.item)); // rebuild items in the new order (prunes dead refs)
    setDragIdx(null);
    setOverIdx(null);
  }

  function removeBlock(b: ResolvedBlock) {
    if (isInline(b.item)) cb.removeNote(id, b.item.id);
    else cb.removeItem(id, b.item);
  }
  const pinnedHit = (cite: NoteCite) => pinned && pinned.identifier === cite.identifier && pinned.paraIndex === cite.paraIndex;

  function exportMd() {
    if (!c) return;
    const lines = [`# ${c.name}`, "", "_My own notes, with the law I cited. Not legal advice._", ""];
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.text}`);
      for (const cite of b.cites) lines.push(`   — ${cite.sectionLabel} ${cite.heading} (${cite.identifier})`);
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

  const { user } = useAuth();
  const seed = useServerFn(seedThreadFromHandoff);
  const [sending, setSending] = useState(false);
  async function sendToWorkspace() {
    if (!c || !user || sending) return;
    setSending(true);
    try {
      const lines = [
        `I'm working on **${c.name}**. Here are my margin notes and the authority I've pulled so far:`,
        "",
      ];
      blocks.forEach((b, i) => {
        lines.push(`${i + 1}. ${b.text}`);
        for (const cite of b.cites) lines.push(`   — \`${cite.identifier}\` — ${cite.sectionLabel} ${cite.heading}`);
      });
      lines.push("", "Please use `fetch_document` on each identifier above to read them in full, then help me reason through the case, find any missing authority, and draft what I need.");
      const res = await seed({
        data: {
          title: `Re: ${c.name}`.slice(0, 80),
          messages: [{ role: "user", parts: [{ type: "text", text: lines.join("\n") }] }],
        },
      });
      navigate({ to: "/workspace/$threadId", params: { threadId: res.threadId } });
    } catch (e) {
      console.error("[case → workspace] failed:", e);
      setSending(false);
    }
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

  const totalCites = c
    ? new Set(c.items.flatMap((it) => (isInline(it) ? it.cites.map((x) => x.identifier) : [it.identifier]))).size
    : 0;

  const rightRail = pinned && isWide ? (
    <CitationPanel pinned={pinned} onClose={() => setPinned(null)} />
  ) : (
    <div className="text-sm text-muted-foreground">
      <div className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Reading room</div>
      <p className="mt-2 leading-relaxed">Pick <span className="font-medium text-foreground/80">“read”</span> on any point to pull the law up here and re-read the exact clause while you polish — without leaving your draft.</p>
    </div>
  );

  return (
    <ResearchShell sources={sources} centerMaxWidth="max-w-3xl" right={rightRail} rightLabel="Reading room">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/cases" className="citation-tag inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> The casebook
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {user && blocks.length > 0 && (
            <button
              type="button"
              onClick={sendToWorkspace}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50"
              style={{ borderColor: "rgba(200,162,75,0.6)", background: "rgba(200,162,75,0.12)" }}
              aria-label="Send to AI Workspace"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Send to Workspace
            </button>
          )}
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

      {/* the document — a sheet you can watch take shape */}
      <article className="rounded-2xl border border-border bg-[var(--paper-soft,var(--card))] px-7 py-9 shadow-[var(--shadow-warm)] sm:px-12 sm:py-12">
        <header className="border-b-2 border-ochre/40 pb-5 text-center">
          <div className="citation-tag inline-flex items-center gap-1.5 text-terracotta"><Scale className="h-3.5 w-3.5" /> Working draft</div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => cb.rename(id, nameDraft)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Untitled case"
            className="mt-2 w-full bg-transparent text-center font-display text-3xl font-semibold tracking-tight outline-none md:text-4xl"
          />
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Prepared by the reader · {blocks.length} point{blocks.length === 1 ? "" : "s"} · {totalCites} citation{totalCites === 1 ? "" : "s"}
          </div>
        </header>

        {!cb.hydrated ? (
          <div className="mt-8 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-muted/50" />)}</div>
        ) : blocks.length === 0 ? (
          <div className="py-14 text-center">
            <PenLine className="mx-auto h-6 w-6 text-ochre" />
            <p className="mt-3 font-display text-lg font-semibold">A blank page</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Open the law, write a note in the margin, and type <span className="font-mono">@{c?.name}</span> to file it
              here. Each point lands on the page with its citation, ready to arrange.
            </p>
            <Link to="/code" className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted/60">Go read the law</Link>
          </div>
        ) : (
          <ol className="mt-7 space-y-6">
            {blocks.map((b, i) => (
              <li
                key={b.key}
                draggable={editing !== (isInline(b.item) ? b.item.id : null)}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDrop={() => drop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`group relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-lg px-1 py-1 transition ${
                  dragIdx === i ? "opacity-50" : ""
                } ${overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-1 ring-ochre/50" : ""}`}
              >
                {/* gutter: paragraph number + drag handle */}
                <div className="select-none pt-1 text-right">
                  <span className="font-mono text-[12px] text-foreground/40 group-hover:hidden">¶{i + 1}</span>
                  <span className="hidden cursor-grab text-muted-foreground/60 active:cursor-grabbing group-hover:inline-flex" title="Drag to reorder">
                    <GripVertical className="h-4 w-4" />
                  </span>
                </div>
                <div className="min-w-0">
                  {b.editable && editing === (b.item as { id: string }).id ? (
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => { cb.updateNote(id, (b.item as { id: string }).id, editDraft); setEditing(null); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setEditing(null); } }}
                      rows={3}
                      className="w-full resize-y rounded-md border border-ochre bg-background px-2 py-1.5 font-serif text-[1.05rem] leading-relaxed outline-none"
                    />
                  ) : (
                    <p
                      className={`whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed text-foreground ${b.editable ? "cursor-text rounded hover:bg-muted/40" : ""}`}
                      onClick={() => { if (b.editable) { setEditing((b.item as { id: string }).id); setEditDraft(b.text); } }}
                      title={b.editable ? "Click to edit" : undefined}
                    >
                      {b.text || (b.editable ? "（empty — click to write）" : "")}
                    </p>
                  )}

                  {/* authority line(s): one per citation */}
                  <div className="mt-1.5 space-y-1">
                    {b.cites.length > 1 && (
                      <div className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        <Layers className="h-3 w-3 text-terracotta" /> synthesis · {b.cites.length} authorities
                      </div>
                    )}
                    {b.cites.map((cite, ci) => (
                      <div key={ci} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="min-w-0 font-mono text-[11px] text-terracotta">— {cite.sectionLabel} {cite.heading}</span>
                        <button
                          type="button"
                          onClick={() => setPinned(pinnedHit(cite) ? null : { identifier: cite.identifier, paraIndex: cite.paraIndex })}
                          className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${pinnedHit(cite) ? "text-terracotta" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <BookOpen className="h-3 w-3" /> {pinnedHit(cite) ? "reading" : "read"}
                        </button>
                        <Link
                          to="/code/$"
                          params={{ _splat: cite.identifier.replace(/^\//, "") }}
                          search={{ q: undefined }}
                          hash={`para-${cite.paraIndex}`}
                          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          open <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => { removeBlock(b); setPinned(null); }}
                      className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                    >
                      remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {blocks.length > 0 && (
          <p className="mt-8 border-t border-border/50 pt-4 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Drag a point by its handle to set the order it reads in
          </p>
        )}
      </article>

      {/* the framing — non-negotiable */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        <span className="font-display font-semibold text-foreground">This is your work product.</span> Your own words and
        the law you chose to cite — a rough draft to help you say what you believe and back it up, or to research. It is{" "}
        <span className="font-semibold">not legal advice and not an interpretation</span> by Marginalia. Whether an
        argument has merit is for a court to decide. Saved only on this device.
      </div>

      {/* Reading room as a drawer below xl, where there's no room for the side
          rail — same "read" affordance, just over the page instead of beside it. */}
      {pinned && !isWide && (
        <div className="fixed inset-0 z-50 flex xl:hidden" role="dialog" aria-label="Reading room">
          <button
            type="button"
            aria-label="Close reading room"
            onClick={() => setPinned(null)}
            className="flex-1 bg-foreground/30 backdrop-blur-[1px]"
          />
          <div className="ml-auto h-full w-full max-w-md overflow-y-auto border-l border-border bg-card px-5 py-5 shadow-[var(--shadow-warm)]">
            <CitationPanel pinned={pinned} onClose={() => setPinned(null)} />
          </div>
        </div>
      )}
    </ResearchShell>
  );
}
