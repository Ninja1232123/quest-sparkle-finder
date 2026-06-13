import { Trash2, ArrowRightToLine, Plus, Scale, ShieldAlert, HelpCircle, ExternalLink } from "lucide-react";
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
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3.5" style={{ borderColor: "var(--rule-card)" }}>
        <div className="flex items-center gap-2">
          <div
            className="grid h-6 w-6 shrink-0 place-items-center rounded"
            style={{ background: "color-mix(in oklab, var(--brass, #c8a24b) 18%, transparent)" }}
          >
            <Scale className="h-3.5 w-3.5" style={{ color: "var(--brass, #c8a24b)" }} />
          </div>
          <div>
            <div className="text-[10px] font-medium tracking-[0.22em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
              Case Brief
            </div>
            <div className="text-[13px] font-semibold leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
              Build your argument
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Supporting */}
        <Stack
          label="Authority for my position"
          sublabel="Statutes, rules, and precedent that support each element of your claim"
          color={stanceColor("support")}
          icon={<Scale className="h-3 w-3" />}
          items={support}
          onInsert={onInsert}
          onDelete={onDelete}
          ghost={
            <GhostCard
              citation="42 U.S.C. § 1983"
              heading="Civil action for deprivation of rights"
              quote="Every person who, under color of any statute… subjects any citizen to the deprivation of any rights…"
              note="Creates the federal cause of action. Pin this to establish your legal basis."
              color={stanceColor("support")}
            />
          }
        />

        {/* Adverse */}
        <Stack
          label="What I'm up against"
          sublabel="Law that cuts against you — know it before they use it"
          color={stanceColor("adverse")}
          icon={<ShieldAlert className="h-3 w-3" />}
          items={adverse}
          onInsert={onInsert}
          onDelete={onDelete}
          ghost={
            <GhostCard
              citation="Twombly / Iqbal standard"
              heading="Plausibility pleading requirement"
              quote="A complaint must contain sufficient factual matter… to state a claim that is plausible on its face."
              note="The threshold you have to clear. Know what they'll argue at 12(b)(6)."
              color={stanceColor("adverse")}
            />
          }
        />

        {/* Open Questions */}
        <Stack
          label="Elements still unresolved"
          sublabel="What still needs to be established before you can file"
          color="var(--brass, #c8a24b)"
          icon={<HelpCircle className="h-3 w-3" />}
          items={questions}
          onInsert={onInsert}
          onDelete={onDelete}
          ghost={
            <GhostCard
              citation="Standing — injury in fact"
              heading="Do I have a cognizable injury?"
              quote=""
              note="Every claim needs a concrete, particularized harm. Establish this before filing."
              color="var(--brass, #c8a24b)"
            />
          }
          extraHeader={
            <button
              type="button"
              onClick={onAddQuestion}
              className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-foreground/8"
              style={{ color: "var(--ink-muted)" }}
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          }
        />
      </div>

      {/* Footer hint */}
      <div
        className="shrink-0 border-t px-4 py-2.5"
        style={{ borderColor: "var(--rule-card)" }}
      >
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
          Pin law from search or accept an AI suggestion. Insert any card directly into your draft.
        </p>
      </div>
    </aside>
  );
}

function Stack({
  label, sublabel, color, icon, items, onInsert, onDelete, ghost, extraHeader,
}: {
  label: string;
  sublabel: string;
  color: string;
  icon: React.ReactNode;
  items: CaseItem[];
  onInsert: (i: CaseItem) => void;
  onDelete: (i: CaseItem) => void;
  ghost: React.ReactNode;
  extraHeader?: React.ReactNode;
}) {
  return (
    <div>
      {/* Stack header */}
      <div className="mb-2 flex items-start gap-2">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded"
          style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}
            >
              {label}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-medium tabular-nums"
              style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
            >
              {items.length}
            </span>
            {extraHeader}
          </div>
          <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--ink-muted)" }}>
            {sublabel}
          </p>
        </div>
      </div>

      {/* Items or ghost */}
      {items.length === 0 ? (
        <div className="opacity-40 pointer-events-none select-none">
          {ghost}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} color={color} onInsert={onInsert} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function GhostCard({ citation, heading, quote, note, color }: {
  citation: string;
  heading: string;
  quote: string;
  note: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: "var(--rule-card)", borderLeftWidth: 3, borderLeftColor: color, background: "var(--paper)" }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="text-[12px] font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          {citation}
        </div>
        <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-40" />
      </div>
      {heading && <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-muted)" }}>{heading}</div>}
      {quote && (
        <p className="mt-1.5 text-[11px] italic leading-snug" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
          "{quote}"
        </p>
      )}
      <p className="mt-1.5 text-[10px] leading-snug" style={{ color: "var(--ink-muted)" }}>{note}</p>
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
      className="group relative rounded-lg border bg-card p-2.5 transition-all hover:shadow-md"
      style={{
        borderColor: "var(--rule-card)",
        borderLeftWidth: 3,
        borderLeftColor: color,
        boxShadow: "0 1px 3px rgba(26,24,20,0.06)",
      }}
    >
      {isAuthority ? (
        <>
          {item.identifier ? (
            <a
              href={`/code/${item.identifier}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-1 text-[12px] font-semibold leading-snug hover:underline"
              style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}
            >
              <span>{item.citation || item.identifier}{item.pin_cite ? <span className="opacity-60"> {item.pin_cite}</span> : null}</span>
              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-30" />
            </a>
          ) : (
            <div className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{item.citation}</div>
          )}
          {item.heading && (
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--ink-muted)" }}>{item.heading}</div>
          )}
          {item.quote && (
            <p className="mt-1.5 line-clamp-3 rounded bg-foreground/[0.03] px-2 py-1 text-[11px] italic leading-relaxed" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
              "{item.quote}"
            </p>
          )}
          {item.user_note && (
            <p className="mt-1.5 text-[10px] leading-snug" style={{ color: "var(--ink-muted)" }}>{item.user_note}</p>
          )}
        </>
      ) : (
        <p className="text-[12px] leading-snug" style={{ color: "var(--ink)" }}>{item.user_note || item.citation || "(question)"}</p>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1 border-t pt-1.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ borderColor: "var(--rule-card)" }}>
        {isAuthority && (
          <button
            type="button"
            onClick={() => onInsert(item)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-foreground/6"
            style={{ color: "var(--ink)" }}
            title="Insert into draft"
          >
            <ArrowRightToLine className="h-3 w-3" /> Insert
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-destructive/10 hover:text-destructive"
          style={{ color: "var(--ink-muted)" }}
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
