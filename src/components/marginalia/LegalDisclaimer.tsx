import { AlertTriangle } from "lucide-react";

/**
 * Prominent "not legal advice" banner. Used at the top of the AI
 * workspace, the Juri chat panel, and the handoff confirmation so
 * the user is reminded — every time they touch the AI — that the
 * model can be wrong and is not a substitute for an attorney.
 */
export function LegalDisclaimer({
  variant = "bar",
  className = "",
}: {
  variant?: "bar" | "inline" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p
        className={`text-[12px] leading-snug tracking-wide ${className}`}
        style={{ color: "rgba(0,0,0,0.55)", fontFamily: "var(--font-mono, 'Special Elite')" }}
      >
        Not legal advice. AI can be wrong — verify every citation and consult a licensed attorney.
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${className}`}
        style={{
          borderColor: "rgba(180,60,40,0.35)",
          background: "rgba(200,80,55,0.08)",
          color: "rgba(80,30,20,0.95)",
        }}
        role="note"
      >
        <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-[0.18em]" style={{ fontSize: 10 }}>
          <AlertTriangle className="h-3 w-3" /> Not legal advice
        </div>
        <p>
          This is an AI tool for legal research and drafting. Output may be inaccurate,
          incomplete, or out of date. <strong>Verify every citation</strong>, check the law
          yourself, and consult a licensed attorney before relying on anything here. Use at
          your own risk.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 border-b px-4 py-2 text-[12px] leading-snug ${className}`}
      style={{
        borderColor: "rgba(180,60,40,0.3)",
        background: "rgba(200,80,55,0.08)",
        color: "rgba(80,30,20,0.95)",
        fontFamily: "var(--font-mono, 'Special Elite')",
      }}
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        <strong className="uppercase tracking-[0.18em]">Not legal advice.</strong>{" "}
        AI output can be wrong. Verify every citation, check the source, and consult a
        licensed attorney before acting. Use at your own risk.
      </p>
    </div>
  );
}