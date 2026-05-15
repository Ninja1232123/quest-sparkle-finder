import { useEffect, useState } from "react";
import { Hammer, X } from "lucide-react";

const KEY = "marg.dev-notice.dismissed.v1";

export function DevNoticeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-6 py-2 text-xs">
        <Hammer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="flex-1 leading-relaxed">
          <span className="font-display font-semibold">Built sporadically by one person.</span>{" "}
          Some corners are still rough — if something looks broken, check back in a day or two. Thanks for poking around.
        </p>
        <button
          type="button"
          onClick={() => {
            try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
            setShow(false);
          }}
          aria-label="Dismiss notice"
          className="rounded-full p-1 text-amber-900/70 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200/70 dark:hover:text-amber-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}