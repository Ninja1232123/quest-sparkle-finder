import { FilePen, Plus, Trash2, CornerDownLeft, HelpCircle } from "lucide-react";
import type { CaseItem } from "@/components/workspace/CaseBoard";
import { Panel } from "./Panel";

type Bucket = {
  key: "support" | "neutral" | "adverse";
  label: string;
  color: string;
  tint: string;
};

const BUCKETS: Bucket[] = [
  { key: "support", label: "Good", color: "#3f9e57", tint: "rgba(63,158,87,0.10)" },
  { key: "neutral", label: "Worth mentioning", color: "#c98a1e", tint: "rgba(216,161,58,0.12)" },
  { key: "adverse", label: "Bad", color: "#cf4b4b", tint: "rgba(207,75,75,0.10)" },
];

export function RefinedIssues({
  items,
  docOpen,
  onToggleDoc,
  onInsert,
  onDelete,
  onAddQuestion,
}: {
  items: CaseItem[];
  docOpen: boolean;
  onToggleDoc: () => void;
  onInsert: (item: CaseItem) => void;
  onDelete: (item: CaseItem) => void;
  onAddQuestion: () => void;
}) {
  const authorities = items.filter((i) => i.kind === "authority");
  const questions = items.filter((i) => i.kind === "question");
  const inBucket = (b: Bucket) =>
    authorities.filter((i) =>
      b.key === "support" ? i.stance === "support" || i.stance == null : i.stance === b.key,
    );

  return (
    <Panel
      label="Refined Issues"
      accent="#cf4b4b"
      footer={
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-[0.18em] uppercase"
            style={{ background: "rgba(207,75,75,0.18)", color: "#ff9b9b", fontFamily: "var(--font-mono, 'Special Elite')" }}
          >
            Issues
          </span>
          <button
            type="button"
            onClick={onAddQuestion}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wider uppercase transition-colors hover:bg-[rgba(200,162,75,0.15)]"
            style={{ color: "rgba(230,236,247,0.7)", boxShadow: "inset 0 0 0 1px rgba(200,162,75,0.25)" }}
          >
            <Plus className="h-3 w-3" /> Question
          </button>
          <button
            type="button"
            onClick={onToggleDoc}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] uppercase transition-transform hover:scale-[1.03]"
            style={{
              background: docOpen ? "#0c1b3d" : "#7bb651",
              color: docOpen ? "#7bb651" : "#0c1b3d",
              boxShadow: `inset 0 0 0 1.5px #7bb651, 0 0 14px ${docOpen ? "transparent" : "rgba(123,182,81,0.5)"}`,
              fontFamily: "var(--font-mono, 'Special Elite')",
            }}
          >
            <FilePen className="h-3.5 w-3.5" />
            {docOpen ? "Close" : "Doc Creator"}
          </button>
        </div>
      }
      bodyClassName="overflow-y-auto"
    >
      <div className="space-y-2 p-2.5">
        {BUCKETS.map((b) => {
          const rows = inBucket(b);
          return (
            <div key={b.key}>
              <div className="mb-1 flex items-center gap-1.5 px-0.5">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
                <span className="text-[11px] font-semibold tracking-[0.24em] uppercase" style={{ color: b.color, fontFamily: "var(--font-mono, 'Special Elite')" }}>
                  {b.label}
                </span>
                <span className="text-[10.5px]" style={{ color: "rgba(230,236,247,0.4)" }}>{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <div
                  className="rounded-md px-2 py-2.5 text-center text-[11.5px]"
                  style={{ background: b.tint, color: "rgba(230,236,247,0.45)", boxShadow: `inset 0 0 0 1px ${b.color}33` }}
                >
                  Grab authority from the sources to file it here.
                </div>
              ) : (
                <ul className="space-y-1">
                  {rows.map((it) => (
                    <IssueCard key={it.id} item={it} color={b.color} tint={b.tint} onInsert={onInsert} onDelete={onDelete} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {questions.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 px-0.5">
              <HelpCircle className="h-3 w-3" style={{ color: "#9fb3d8" }} />
              <span className="text-[11px] font-semibold tracking-[0.24em] uppercase" style={{ color: "#9fb3d8", fontFamily: "var(--font-mono, 'Special Elite')" }}>
                Open questions
              </span>
            </div>
            <ul className="space-y-1">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="group flex items-start gap-1.5 rounded-md px-2 py-1.5"
                  style={{ background: "rgba(159,179,216,0.10)", boxShadow: "inset 0 0 0 1px rgba(159,179,216,0.2)" }}
                >
                  <span className="flex-1 text-[11px] leading-snug" style={{ color: "rgba(230,236,247,0.85)" }}>{q.user_note}</span>
                  <button type="button" onClick={() => onDelete(q)} className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100" aria-label="Delete">
                    <Trash2 className="h-3 w-3" style={{ color: "#ffb4b4" }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function IssueCard({
  item,
  color,
  tint,
  onInsert,
  onDelete,
}: {
  item: CaseItem;
  color: string;
  tint: string;
  onInsert: (i: CaseItem) => void;
  onDelete: (i: CaseItem) => void;
}) {
  const cite = item.citation || item.identifier || "Authority";
  return (
    <li
      className="group rounded-md px-2 py-1.5"
      style={{ background: tint, boxShadow: `inset 0 0 0 1px ${color}40`, borderLeft: `2px solid ${color}` }}
    >
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold" style={{ color: "#eef3fb", fontFamily: "var(--font-serif, 'Cinzel')" }}>
            {cite}
          </div>
          {item.heading && <div className="truncate text-[11.5px]" style={{ color: "rgba(230,236,247,0.55)" }}>{item.heading}</div>}
          {item.quote && (
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug" style={{ color: "rgba(230,236,247,0.65)" }}>
              “{item.quote}”{item.pin_cite ? ` ${item.pin_cite}` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" title="Insert into draft" onClick={() => onInsert(item)} className="hover:scale-110">
            <CornerDownLeft className="h-3.5 w-3.5" style={{ color: "#c8a24b" }} />
          </button>
          <button type="button" title="Remove" onClick={() => onDelete(item)} className="hover:scale-110">
            <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff9b9b" }} />
          </button>
        </div>
      </div>
    </li>
  );
}
