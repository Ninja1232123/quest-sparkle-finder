import { Search, Pin, ShieldAlert, HelpCircle, X, Check } from "lucide-react";
import type { PinDraft } from "./PinDialog";

export type ProposalPayload =
  | { proposal: "search"; query: string; source?: string; why: string }
  | { proposal: "pin"; stance: "support" | "adverse" | "neutral"; identifier: string; citation: string; heading?: string; suggested_quote: string; suggested_pin_cite?: string; why_it_matters: string }
  | { proposal: "question"; text: string; why?: string };

type Props = {
  payload: ProposalPayload;
  dismissed: boolean;
  accepted: boolean;
  onRunSearch: (q: string, source?: string) => void;
  onOpenPin: (draft: PinDraft) => void;
  onAddQuestion: (text: string) => Promise<void> | void;
  onDismiss: () => void;
};

export function ProposalCard({ payload, dismissed, accepted, onRunSearch, onOpenPin, onAddQuestion, onDismiss }: Props) {
  if (dismissed) {
    return <div className="rounded border border-dashed px-2 py-1 text-[10px]" style={{ borderColor: "var(--rule-card)", color: "var(--ink-muted)" }}>Suggestion dismissed.</div>;
  }
  if (payload.proposal === "search") {
    return (
      <Card icon={<Search className="h-3.5 w-3.5" />} label="Suggested search" accepted={accepted} onDismiss={onDismiss}>
        <div className="font-mono text-[12px]" style={{ color: "var(--ink)" }}>"{payload.query}"{payload.source ? <span className="opacity-60"> · {payload.source.toUpperCase()}</span> : null}</div>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>{payload.why}</p>
        {!accepted && (
          <div className="mt-1.5 flex gap-1">
            <BtnPrimary onClick={() => onRunSearch(payload.query, payload.source)}>Run search</BtnPrimary>
          </div>
        )}
      </Card>
    );
  }
  if (payload.proposal === "pin") {
    const Icon = payload.stance === "adverse" ? ShieldAlert : Pin;
    return (
      <Card icon={<Icon className="h-3.5 w-3.5" />} label={payload.stance === "adverse" ? "Suggested adverse authority" : "Suggested authority"} accepted={accepted} onDismiss={onDismiss}>
        <a href={`/code/${payload.identifier}`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold hover:underline" style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
          {payload.citation}{payload.suggested_pin_cite ? <span className="opacity-70"> {payload.suggested_pin_cite}</span> : null}
        </a>
        {payload.heading && <div className="text-[10px]" style={{ color: "var(--ink-muted)" }}>{payload.heading}</div>}
        {payload.suggested_quote && (
          <p className="mt-1 line-clamp-3 text-[11px] italic" style={{ color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
            "{payload.suggested_quote}"
          </p>
        )}
        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>{payload.why_it_matters}</p>
        {!accepted && (
          <div className="mt-1.5 flex gap-1">
            <BtnPrimary onClick={() => onOpenPin({
              identifier: payload.identifier,
              citation: payload.citation,
              heading: payload.heading ?? null,
              stance: payload.stance,
              pinCite: payload.suggested_pin_cite,
              quote: payload.suggested_quote,
              userNote: payload.why_it_matters,
            })}>Review &amp; pin</BtnPrimary>
          </div>
        )}
      </Card>
    );
  }
  // question
  return (
    <Card icon={<HelpCircle className="h-3.5 w-3.5" />} label="Suggested question" accepted={accepted} onDismiss={onDismiss}>
      <p className="text-[12px]" style={{ color: "var(--ink)" }}>{payload.text}</p>
      {payload.why && <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>{payload.why}</p>}
      {!accepted && (
        <div className="mt-1.5 flex gap-1">
          <BtnPrimary onClick={() => onAddQuestion(payload.text)}>Add to board</BtnPrimary>
        </div>
      )}
    </Card>
  );
}

function Card({ icon, label, accepted, onDismiss, children }: {
  icon: React.ReactNode; label: string; accepted: boolean; onDismiss: () => void; children: React.ReactNode;
}) {
  return (
    <div className="my-1.5 rounded-md border p-2" style={{ borderColor: "var(--brass, #c8a24b)", background: "color-mix(in oklab, var(--brass, #c8a24b) 6%, transparent)" }}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
        {icon}
        <span>{label}</span>
        {accepted && <span className="ml-1 inline-flex items-center gap-0.5 text-[9px]" style={{ color: "#3f7d4e" }}><Check className="h-2.5 w-2.5" /> done</span>}
        {!accepted && (
          <button type="button" onClick={onDismiss} className="ml-auto rounded p-0.5 hover:bg-foreground/5" title="Dismiss">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BtnPrimary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded px-2 py-1 text-[11px] font-medium text-white transition-colors" style={{ background: "var(--ink)" }}>
      {children}
    </button>
  );
}