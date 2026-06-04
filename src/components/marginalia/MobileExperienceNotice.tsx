import { useEffect, useState } from "react";
import { Monitor, X } from "lucide-react";

/**
 * Small-screen heads-up. The writing tools — the Desk, margin notes, and
 * casefiles — need the wide desktop layout and only mount at the `lg`
 * breakpoint, so phones/most tablets get a read-only view. Without a word,
 * that reads as "broken"; this says "use a bigger screen" instead.
 *
 * Hidden at lg+ via CSS (where the tools exist), and dismissible — the choice
 * persists in localStorage so it shows once, not on every page.
 */
export function MobileExperienceNotice() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("mobile-notice-dismissed") === "1") setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div className="lg:hidden relative flex items-start gap-2.5 border-b border-ochre/30 bg-ochre/10 px-4 py-2.5 text-[13px] leading-snug text-foreground/80">
      <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-ochre" />
      <p className="min-w-0 flex-1 pr-5">
        <span className="font-semibold text-foreground">You're on a small screen — reading view only.</span>{" "}
        Margin notes, the Desk, and casefiles need a laptop or desktop. Open Marginalia on a computer for the full
        toolkit.
      </p>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem("mobile-notice-dismissed", "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:bg-ochre/20 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
