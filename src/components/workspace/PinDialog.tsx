import { useState } from "react";
import { X } from "lucide-react";

export type PinDraft = {
  identifier?: string | null;
  citation?: string | null;
  heading?: string | null;
  stance: "support" | "adverse" | "neutral";
  pinCite?: string;
  quote?: string;
  userNote?: string;
};

type Props = {
  open: boolean;
  draft: PinDraft | null;
  title?: string;
  onClose: () => void;
  onSave: (d: Required<Pick<PinDraft, "stance">> & PinDraft) => Promise<void> | void;
};

export function PinDialog({ open, draft, title = "Pin authority to case", onClose, onSave }: Props) {
  const [stance, setStance] = useState<"support" | "adverse" | "neutral">(draft?.stance ?? "support");
  const [pinCite, setPinCite] = useState(draft?.pinCite ?? "");
  const [quote, setQuote] = useState(draft?.quote ?? "");
  const [note, setNote] = useState(draft?.userNote ?? "");
  const [saving, setSaving] = useState(false);

  // Reset when draft changes
  const draftKey = draft ? `${draft.identifier ?? ""}-${draft.stance}` : "";
  const [seedKey, setSeedKey] = useState(draftKey);
  if (seedKey !== draftKey && draft) {
    setSeedKey(draftKey);
    setStance(draft.stance);
    setPinCite(draft.pinCite ?? "");
    setQuote(draft.quote ?? "");
    setNote(draft.userNote ?? "");
  }

  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in oklab, var(--ink) 55%, transparent)" }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg rounded-lg border shadow-2xl" style={{ background: "var(--paper)", borderColor: "var(--brass, #c8a24b)" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>{title}</div>
            <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
              {draft.citation || draft.identifier}
            </div>
            {draft.heading && <div className="text-xs" style={{ color: "var(--ink-muted)" }}>{draft.heading}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-foreground/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <Label>Stance</Label>
            <div className="mt-1 flex gap-1">
              {(["support", "adverse", "neutral"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStance(s)}
                  className="rounded-full border px-3 py-1 text-[11px] tracking-[0.15em] uppercase transition-colors"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: stance === s ? stanceColor(s) : "var(--rule-card)",
                    background: stance === s ? `color-mix(in oklab, ${stanceColor(s)} 20%, transparent)` : "transparent",
                    color: stance === s ? "var(--ink)" : "var(--ink-muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Pin-cite <span className="opacity-60">(optional)</span></Label>
            <input
              value={pinCite}
              onChange={(e) => setPinCite(e.target.value)}
              placeholder="(a)(2), comment 3, ¶ 4…"
              className="mt-1 w-full rounded border bg-card px-2 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--rule-card)" }}
            />
          </div>
          <div>
            <Label>Operative quote</Label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={4}
              placeholder="Paste or trim the actual statutory language you want to use."
              className="mt-1 w-full rounded border bg-card px-2 py-1.5 text-sm leading-relaxed outline-none"
              style={{ borderColor: "var(--rule-card)", fontFamily: "var(--font-serif)" }}
            />
          </div>
          <div>
            <Label>Why this matters to your case</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="One line for your future self."
              className="mt-1 w-full rounded border bg-card px-2 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--rule-card)" }}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: "var(--rule-card)" }}>
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-xs hover:bg-foreground/5">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ ...draft, stance, pinCite, quote, userNote: note });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="rounded px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--ink)" }}
          >
            {saving ? "Pinning…" : "Pin to case"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>{children}</div>;
}

export function stanceColor(s: "support" | "adverse" | "neutral") {
  if (s === "support") return "#3f7d4e";
  if (s === "adverse") return "#a8413a";
  return "var(--brass, #c8a24b)";
}