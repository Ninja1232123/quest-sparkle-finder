import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const KEY = "selflaw_tos_ack_v1";
const VERSION = "2026-06-12";

/**
 * Hard ToS gate. Blocks the entire site until the user explicitly agrees
 * that nothing here is legal advice and that AI misuse is on them.
 * Persists acknowledgement in localStorage keyed by version so we can
 * force a re-accept if the terms ever change.
 */
export function TosGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v !== VERSION) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {
      // best-effort; still let them in for the session
    }
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(20,12,8,0.92)" }}
    >
      <div
        className="relative w-full max-w-xl rounded-lg border shadow-2xl"
        style={{
          background: "#f6efe1",
          borderColor: "rgba(80,40,20,0.4)",
          fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
          color: "#1a1208",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-5 py-3 text-[12px] uppercase tracking-[0.22em]"
          style={{
            borderColor: "rgba(80,40,20,0.25)",
            fontFamily: "var(--font-mono, 'Special Elite')",
            color: "rgba(120,40,20,0.95)",
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Read this before you go in
        </div>

        <div className="px-6 py-5">
          <h2 id="tos-title" className="font-display text-2xl font-semibold tracking-tight">
            Self-Law is a reading room, not a lawyer.
          </h2>

          <div className="mt-4 space-y-3 text-[14px] leading-relaxed">
            <p>
              This site exists so regular people can <em>read the law for themselves</em>
              and learn how to defend their own rights. That's it.
            </p>
            <p>
              <strong>Nothing on this site is legal advice.</strong> No article, no
              search result, no AI answer, no generated draft, no citation, no
              chat from Juri — none of it. The law shown here may be wrong,
              outdated, missing context, or flat out misinterpreted. Verify
              everything against an official source and, if it matters, talk to
              a licensed attorney in your jurisdiction.
            </p>
            <p>
              The AI tools are a research assistant. If you push the AI to write
              briefs, motions, contracts, demand letters, or anything else you
              then file or send to another party, <strong>that is on you</strong>.
              Any harm, loss, sanction, or embarrassment that follows is your
              responsibility, not mine and not this site's.
            </p>
            <p>
              By continuing you agree: you will not treat this site as legal
              advice, you will not blame the site or its operator for any
              outcome of using it, and you accept all risk of acting on
              anything you read or generate here.
            </p>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2 text-[13px] leading-snug">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#7a2a14]"
            />
            <span>
              I understand this is not legal advice, and I accept full
              responsibility for anything I do with what I find or generate here.
            </span>
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <a
              href="https://www.google.com"
              className="text-[12px] underline opacity-70 hover:opacity-100"
            >
              I don't agree — leave
            </a>
            <button
              type="button"
              onClick={accept}
              disabled={!checked}
              className="rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "#1a1208",
                color: "#f6efe1",
                fontFamily: "var(--font-mono, 'Special Elite')",
                letterSpacing: "0.08em",
              }}
            >
              I agree — enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}