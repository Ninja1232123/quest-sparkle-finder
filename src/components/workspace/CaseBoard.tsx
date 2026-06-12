import { Trash2, ArrowRightToLine, Plus, Scale, ShieldAlert, HelpCircle } from "lucide-react";
import { stanceColor } from "./PinDialog";

export type CaseItem = {
  id: string;
  kind: "authority" | "question" | "note";
  stance: "support" | "adverse" | "neutral" | null;
  identifier: string | null;
  citation: string | null;
  heading: string | null;
  pin_cite: string | null;
  quote: string | null;
  user_note: string | null;
  order_index: number;
  created_at: string;
};

type Props = {
  items: CaseItem[];
  onInsert: (item: CaseItem) => void;
  onDelete: (item: CaseItem) => void;
  onAddQuestion: () => void;
};

export function CaseBoard({ items, onInsert, onDelete, onAddQuestion }: Props) {
  const support = items.filter((i) => i.kind === "authority" && i.stance !== "adverse");
  const adverse = items.filter((i) => i.kind === "authority" && i.stance === "adverse");
  const questions = items.filter((i) => i.kind === "question");

  return (
    <aside
      className="hidden h-full w-[300px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--rule-card)", background: "var(--paper-tint)" }}
    >
      <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
        <div className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
          Case Board
        </div>
        <div className="text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          What you're building
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <Stack
          label="Supporting"
          color={stanceColor("support")}
          icon={<Scale className="h-3 w-3" />}
          items={support}
          onInsert={onInsert}
          onDelete={onDelete}
          empty="Nothing pinned yet. Pin a statute from search or accept an AI suggestion."
        />
        <Stack
          label="Adverse"
          color={stanceColor("adverse")}
          icon={<ShieldAlert className="h-3 w-3" />}
          items={adverse}
          onInsert={onInsert}
          onDelete={onDelete}
          empty="Nothing flagged. Ask the assistant: \u201cwhat cuts against me here?\u201d"
        />
        <Stack
          label="Open questions"
          color="var(--brass, #c8a24b)"
          icon={<HelpCircle className="h-3 w-3" />}
          items={questions}
          onInsert={onInsert}
          onDelete={onDelete}
          empty="No open questions yet."
          extraHeader={
            <button
              type="button"
              onClick={onAddQuestion}
              className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-foreground/5"
              style={{ color: "var(--ink-muted)" }}
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          }
        />
      </div>
    </aside>
  );
}

function Stack({
  label, color, icon, items, onInsert, onDelete, empty, extraHeader,
}: {
  label: string;
  color: string;
  icon: React.ReactNode;
  items: CaseItem[];
  onInsert: (i: CaseItem) => void;
  onDelete: (i: CaseItem) => void;
  empty: string;
  extraHeader?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
        <span className="grid h-4 w-4 place-items-center rounded-sm" style={{ background: `color-mix(in oklab, ${color} 22%, transparent)`, color }}>{icon}</span>
        <span>{label}</span>
        <span className="opacity-60">({items.length})</span>
        {extraHeader}
      </div>
      {items.length === 0 ? (
        <div className="mx-2 rounded border border-dashed px-2 py-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--rule-card)", color: "var(--ink-muted)" }}>
          {empty}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} color={color} onInsert={onInsert} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, color, onInsert, onDelete }: {
  item: CaseItem;
  color: string;
  onInsert: (i: CaseItem) => void;
  onDelete: (i: CaseItem) => void;
}) {
  const isAuthority = item.kind === "authority";
  return (
    <div
      className="group relative mx-2 rounded-md border bg-card p-2 transition-shadow hover:shadow-sm"
      style={{ borderColor: "var(--rule-card)", borderLeftWidth: 3, borderLeftColor: color }}
    >
      {isAuthority ? (
        <>
          {item.identifier ? (
            <a
              href={`/code/${item.identifier}`}
              target="_blank"
              rel="noreferrer"
              className="block text-[12px] font-semibold leading-snug hover:underline"
              style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
            >
              {item.citation || item.identifier}{item.pin_cite ? <span className="opacity-70"> {item.pin_cite}</span> : null}
            </a>
          ) : (
            <div className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{item.citation}</div>
          )}
          {item.heading && <div className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{item.heading}</div>}
          {item.quote && (
            <p className="mt-1 line-clamp-3 text-[11px] italic leading-snug" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
              "{item.quote}"
            </p>
          )}
          {item.user_note && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>{item.user_note}</p>
          )}
        </>
      ) : (
        <p className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>{item.user_note || item.citation || "(question)"}</p>
      )}
      <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {isAuthority && (
          <button
            type="button"
            onClick={() => onInsert(item)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-foreground/5"
            style={{ color: "var(--ink)" }}
            title="Insert into draft"
          >
            <ArrowRightToLine className="h-3 w-3" /> Insert
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-destructive/10 hover:text-destructive"
          style={{ color: "var(--ink-muted)" }}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}