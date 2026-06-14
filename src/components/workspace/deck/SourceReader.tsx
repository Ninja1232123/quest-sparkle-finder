import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, FileText, BookOpen } from "lucide-react";
import { searchCorpus, searchCases, type CaseHit } from "@/lib/workspace.functions";
import type { CorpusHit } from "@/components/workspace/ResultCard";
import type { PinDraft } from "@/components/workspace/PinDialog";
import { Panel, Surface } from "./Panel";

type Scope = "fed" | "state" | "both";

/**
 * US state/territory codes in `documents.source` are always 2 letters (ca, ny, tx…);
 * federal codes never are (usc, cfr, const, ucc, register, irm, tfm, bill). Keying the
 * Fed/State lens off length keeps it correct even if a source label is renamed.
 */
const isStateCode = (s: string) => s.length === 2;

export const STANCES: { stance: PinDraft["stance"]; label: string; color: string }[] = [
  { stance: "support", label: "Good", color: "#3f9e57" },
  { stance: "neutral", label: "Worth mentioning", color: "#d8a13a" },
  { stance: "adverse", label: "Bad", color: "#cf4b4b" },
];

function statuteToDraft(h: CorpusHit, stance: PinDraft["stance"]): PinDraft {
  return {
    identifier: h.identifier,
    citation: `${h.source.toUpperCase()} ${h.sectionLabel || h.identifier}`,
    heading: h.heading,
    stance,
    quote: h.snippet ?? "",
    pinCite: "",
    userNote: "",
  };
}
function caseToDraft(c: CaseHit, stance: PinDraft["stance"]): PinDraft {
  return {
    identifier: c.url ?? c.id,
    citation: c.citation || c.title,
    heading: c.title,
    stance,
    quote: "",
    pinCite: "",
    userNote: [c.court, c.year].filter(Boolean).join(" · "),
  };
}

export function SourceReader({
  onAddIssue,
  onAddToDraft,
  onOpenDoc,
}: {
  onAddIssue: (draft: PinDraft) => void;
  onAddToDraft: (markdown: string) => void;
  onOpenDoc: (ref: string) => void;
}) {
  const [q, setQ] = useState("");
  const [statuteScope, setStatuteScope] = useState<Scope>("both");
  const [caseScope, setCaseScope] = useState<Scope>("both");
  const [commercial, setCommercial] = useState(false);

  const [statHits, setStatHits] = useState<CorpusHit[] | null>(null);
  const [caseHits, setCaseHits] = useState<CaseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useServerFn(searchCorpus);
  const runCases = useServerFn(searchCases);

  const submit = useCallback(
    async (override?: { q?: string; source?: string | null }) => {
      const query = (override?.q ?? q).trim();
      if (query.length < 2) return;
      if (override?.q !== undefined) setQ(override.q);
      const useCommercial = override?.source ? false : commercial;
      const statSource = override?.source ?? (useCommercial ? "ucc" : null);
      const jur = caseScope === "fed" ? "scotus" : caseScope === "state" ? "state" : "";
      setLoading(true);
      setErr(null);
      try {
        const [stat, cases] = await Promise.all([
          run({ data: { q: query, source: statSource, limit: 20 } }) as Promise<CorpusHit[]>,
          runCases({ data: { q: query, jurisdiction: jur, limit: 15 } }) as Promise<CaseHit[]>,
        ]);
        const filtered =
          statSource || statuteScope === "both"
            ? stat
            : stat.filter((h) =>
                statuteScope === "state" ? isStateCode(h.source) : !isStateCode(h.source),
              );
        setStatHits(filtered);
        setCaseHits(cases);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Search failed");
        setStatHits([]);
        setCaseHits([]);
      } finally {
        setLoading(false);
      }
    },
    [q, commercial, caseScope, statuteScope, run, runCases],
  );

  // The assistant can drive a search by dispatching workspace:run-search.
  useEffect(() => {
    const onRun = (e: Event) => {
      const d = (e as CustomEvent<{ q: string; source?: string }>).detail;
      void submit({ q: d.q, source: d.source ?? null });
    };
    window.addEventListener("workspace:run-search", onRun);
    return () => window.removeEventListener("workspace:run-search", onRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  return (
    <Panel
      label="Sources — Statute · Case Law"
      bodyClassName="flex flex-col"
      footer={
        <div className="space-y-1.5">
          <SelectorRow label="Statute" scope={statuteScope} onScope={setStatuteScope}>
            <Toggle active={commercial} color="#7a86c4" onClick={() => setCommercial((c) => !c)}>
              UCC / Commercial
            </Toggle>
          </SelectorRow>
          <SelectorRow label="Case law" scope={caseScope} onScope={setCaseScope} />
        </div>
      }
    >
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="shrink-0 px-2.5 pt-2.5 pb-2"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "rgba(12,27,61,0.45)" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search statutes and case law — or paste a citation…"
            className="w-full rounded-lg py-2.5 pl-9 pr-3 text-sm outline-none"
            style={{
              background: "#fff",
              color: "var(--ink)",
              boxShadow: "inset 0 0 0 1.5px rgba(200,162,75,0.4)",
            }}
          />
        </div>
      </form>

      {err && (
        <div className="mx-2.5 mb-2 rounded-md px-2 py-1 text-[11px]" style={{ background: "rgba(207,75,75,0.15)", color: "#ffd9d9" }}>
          {err}
        </div>
      )}

      {/* Split screen */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-2.5 pb-2.5">
        <Pane title="Statutes" accent="#c8a24b">
          <ResultList
            loading={loading}
            empty={statHits !== null && statHits.length === 0}
            placeholder='Try "qualified immunity" or "42 USC 1983".'
          >
            {statHits?.map((h) => (
              <StatuteRow key={h.identifier} hit={h} onAddIssue={onAddIssue} onAddToDraft={onAddToDraft} onOpenDoc={onOpenDoc} />
            ))}
          </ResultList>
        </Pane>
        <Pane title="Case law" accent="#7aa2d8">
          <ResultList
            loading={loading}
            empty={caseHits !== null && caseHits.length === 0}
            placeholder="SCOTUS + all 50 state supreme courts."
          >
            {caseHits?.map((c) => (
              <CaseRow key={c.id} hit={c} onAddIssue={onAddIssue} onAddToDraft={onAddToDraft} onOpenDoc={onOpenDoc} />
            ))}
          </ResultList>
        </Pane>
      </div>
    </Panel>
  );
}

// ── Layout bits ─────────────────────────────────────────────────────────────
function Pane({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div
        className="mb-1 px-1 text-[10.5px] font-semibold tracking-[0.26em] uppercase"
        style={{ color: accent, fontFamily: "var(--font-mono, 'Special Elite')" }}
      >
        {title}
      </div>
      <Surface className="flex-1 p-1.5">{children}</Surface>
    </div>
  );
}

function ResultList({
  loading,
  empty,
  placeholder,
  children,
}: {
  loading: boolean;
  empty: boolean;
  placeholder: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md" style={{ background: "rgba(12,27,61,0.06)" }} />
        ))}
      </div>
    );
  }
  if (empty) {
    return <div className="px-2 py-6 text-center text-[11px]" style={{ color: "rgba(12,27,61,0.5)" }}>No hits. Try fewer words.</div>;
  }
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return <div className="px-2 py-6 text-center text-[11px]" style={{ color: "rgba(12,27,61,0.45)" }}>{placeholder}</div>;
  }
  return <div className="space-y-1.5">{children}</div>;
}

// ── Result rows ─────────────────────────────────────────────────────────────
function StatuteRow({ hit, onAddIssue, onAddToDraft, onOpenDoc }: { hit: CorpusHit; onAddIssue: (d: PinDraft) => void; onAddToDraft: (md: string) => void; onOpenDoc: (ref: string) => void }) {
  const cite = `${hit.source.toUpperCase()} ${hit.sectionLabel || hit.identifier}`;
  return (
    <Row
      chip={hit.source.toUpperCase()}
      title={hit.heading || cite}
      sub={hit.sectionLabel || hit.parentLabel}
      body={hit.snippet}
      onOpen={() => onOpenDoc(hit.identifier)}
      onStance={(s) => onAddIssue(statuteToDraft(hit, s))}
      onDraft={() => onAddToDraft(`> ${hit.snippet || hit.heading}\n> — ${cite}${hit.heading ? `, "${hit.heading}"` : ""}`)}
    />
  );
}
function CaseRow({ hit, onAddIssue, onAddToDraft, onOpenDoc }: { hit: CaseHit; onAddIssue: (d: PinDraft) => void; onAddToDraft: (md: string) => void; onOpenDoc: (ref: string) => void }) {
  return (
    <Row
      chip={[hit.court, hit.year].filter(Boolean).join(" · ") || "CASE"}
      title={hit.title}
      sub={hit.citation}
      body=""
      onOpen={() => onOpenDoc(hit.id)}
      onStance={(s) => onAddIssue(caseToDraft(hit, s))}
      onDraft={() => onAddToDraft(`${hit.citation || hit.title}`)}
    />
  );
}

function Row({
  chip,
  title,
  sub,
  body,
  onOpen,
  onStance,
  onDraft,
}: {
  chip: string;
  title: string;
  sub?: string;
  body?: string;
  onOpen: () => void;
  onStance: (s: PinDraft["stance"]) => void;
  onDraft: () => void;
}) {
  return (
    <div className="group rounded-md p-2 transition-colors hover:bg-[rgba(200,162,75,0.08)]" style={{ boxShadow: "inset 0 0 0 1px rgba(12,27,61,0.08)" }}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span
          className="rounded px-1 py-0.5 text-[10px] font-semibold tracking-wider"
          style={{ background: "rgba(200,162,75,0.18)", color: "#7a5e16", fontFamily: "var(--font-mono, 'Special Elite')" }}
        >
          {chip}
        </span>
        {sub && <span className="truncate text-[11.5px]" style={{ color: "rgba(12,27,61,0.6)" }}>{sub}</span>}
      </div>
      <button
        type="button"
        onClick={onOpen}
        title="Open in reader — the assistant reads it with you"
        className="block w-full text-left text-[12px] font-medium leading-snug hover:underline"
        style={{ color: "var(--ink)", fontFamily: "var(--font-serif, 'Cinzel')" }}
      >
        {title}
      </button>
      {body ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug" style={{ color: "rgba(12,27,61,0.65)" }}>{body}</p> : null}
      <div className="mt-1.5 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <span className="mr-0.5 text-[9.5px] tracking-widest" style={{ color: "rgba(12,27,61,0.4)" }}>GRAB →</span>
        {STANCES.map((s) => (
          <button
            key={s.stance ?? "n"}
            type="button"
            title={s.label}
            onClick={() => onStance(s.stance)}
            className="h-4 w-4 rounded-full transition-transform hover:scale-110"
            style={{ background: s.color, boxShadow: "0 0 0 1px rgba(0,0,0,0.1)" }}
          />
        ))}
        <button
          type="button"
          title="Open in reader"
          onClick={onOpen}
          className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wider transition-colors hover:bg-[rgba(12,27,61,0.08)]"
          style={{ color: "rgba(12,27,61,0.7)" }}
        >
          <BookOpen className="h-3 w-3" /> READ
        </button>
        <button
          type="button"
          title="Insert into draft"
          onClick={onDraft}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wider transition-colors hover:bg-[rgba(12,27,61,0.08)]"
          style={{ color: "rgba(12,27,61,0.7)" }}
        >
          <FileText className="h-3 w-3" /> DRAFT
        </button>
      </div>
    </div>
  );
}

// ── Selectors ───────────────────────────────────────────────────────────────
function SelectorRow({
  label,
  scope,
  onScope,
  children,
}: {
  label: string;
  scope: Scope;
  onScope: (s: Scope) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10.5px] tracking-[0.18em] uppercase" style={{ color: "rgba(230,236,247,0.7)", fontFamily: "var(--font-mono, 'Special Elite')" }}>
        {label}
      </span>
      <div className="flex rounded-md p-0.5" style={{ background: "rgba(0,0,0,0.25)", boxShadow: "inset 0 0 0 1px rgba(200,162,75,0.25)" }}>
        {(["fed", "state", "both"] as Scope[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onScope(s)}
            className="rounded px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors"
            style={{
              fontFamily: "var(--font-mono, 'Special Elite')",
              background: scope === s ? "#c8a24b" : "transparent",
              color: scope === s ? "#0c1b3d" : "rgba(230,236,247,0.6)",
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

function Toggle({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[11px] font-semibold tracking-wider uppercase transition-colors"
      style={{
        fontFamily: "var(--font-mono, 'Special Elite')",
        background: active ? color : "transparent",
        color: active ? "#0c1b3d" : "rgba(230,236,247,0.6)",
        boxShadow: `inset 0 0 0 1px ${active ? color : "rgba(200,162,75,0.25)"}`,
      }}
    >
      {children}
    </button>
  );
}
