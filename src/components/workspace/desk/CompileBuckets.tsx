import { ArrowRight, X, Scale, ShieldAlert, ShieldCheck } from "lucide-react";

export type BucketId = "adversarial" | "supportive" | "arguable";

export type Snippet = {
  id: string;
  bucket: BucketId;
  text: string;
  citation: string;
  identifier: string;
  heading: string;
  source: string;
  /** Persisted workspace_case_items id, when the save succeeded. */
  caseItemId?: string;
};

export const BUCKETS: {
  id: BucketId;
  label: string;
  hint: string;
  accent: string;
  wash: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  {
    id: "supportive",
    label: "Supportive",
    hint: "Cuts your way",
    accent: "var(--sage-deep)",
    wash: "color-mix(in oklab, var(--sage) 16%, transparent)",
    icon: ShieldCheck,
  },
  {
    id: "arguable",
    label: "Arguable",
    hint: "Could go either way",
    accent: "var(--ochre)",
    wash: "color-mix(in oklab, var(--ochre) 20%, transparent)",
    icon: Scale,
  },
  {
    id: "adversarial",
    label: "Adversarial",
    hint: "Cuts against you",
    accent: "var(--terracotta)",
    wash: "color-mix(in oklab, var(--terracotta) 14%, transparent)",
    icon: ShieldAlert,
  },
];

type Props = {
  snippets: Snippet[];
  onRemove: (id: string) => void;
  onSendToDraft: (s: Snippet) => void;
};

export function CompileBuckets({ snippets, onRemove, onSendToDraft }: Props) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-3">
      {BUCKETS.map((b) => {
        const items = snippets.filter((s) => s.bucket === b.id);
        return (
          <section
            key={b.id}
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card"
            style={{ borderColor: "var(--rule-card)", borderTop: `2px solid ${b.accent}` }}
          >
            <header
              className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
              style={{ background: b.wash }}
            >
              <div className="flex items-center gap-1.5">
                <b.icon className="h-3.5 w-3.5" style={{ color: b.accent }} />
                <span
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}
                >
                  {b.label}
                </span>
              </div>
              <span
                className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold"
                style={{ background: b.accent, color: "var(--paper-soft)" }}
              >
                {items.length}
              </span>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p
                  className="px-1 py-4 text-center text-[11px] leading-relaxed"
                  style={{ color: "var(--ink-muted)" }}
                >
                  {b.hint}. Select text in an open container and send it here.
                </p>
              ) : (
                items.map((s) => (
                  <article
                    key={s.id}
                    className="group rounded-md border bg-paper-soft p-2"
                    style={{ borderColor: "var(--rule-card)" }}
                  >
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}
                    >
                      &ldquo;{s.text}&rdquo;
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span
                        className="truncate text-[9px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}
                        title={s.citation}
                      >
                        {s.citation}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onSendToDraft(s)}
                          title="Quote in the draft"
                          className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-foreground/10"
                          style={{ color: "var(--ink)" }}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(s.id)}
                          title="Remove"
                          className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-foreground/10"
                          style={{ color: "var(--ink-muted)" }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
