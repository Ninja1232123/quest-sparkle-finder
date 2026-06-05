import { useEffect, useState } from "react";
import { PenLine, X } from "lucide-react";

/**
 * Small-screen heads-up. Margin notes DO work on phones — tapping a paragraph
 * opens its composer in the stacked Desk below the article (the side-by-side
 * gutter rail is the only part that needs the wide `lg` layout). So this is an
 * invitation to annotate, not an apology for a read-only view.
 *
 * Hidden at lg+ via CSS (where the side rail takes over), and dismissible — the
 * choice persists in localStorage so it shows once, not on every page.
 */
export function MobileExperienceNotice() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("mobile-notice-dismissed") === "1") setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div className="lg:hidden relative flex items-start gap-2.5 border-b border-sage/30 bg-sage/10 px-4 py-2.5 text-[13px] leading-snug text-foreground/80">
      <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      <p className="min-w-0 flex-1 pr-5">
        <span className="font-semibold text-foreground">
          Tap any paragraph to write a margin note.
        </span>{" "}
        Your notes collect in the Desk below the text and file under cases with{" "}
        <span className="font-mono text-sage">@</span>. The side-by-side margin rail opens on a
        larger screen.
      </p>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem("mobile-notice-dismissed", "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:bg-sage/20 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
