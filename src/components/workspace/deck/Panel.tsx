import type { ReactNode } from "react";

/**
 * Panel — the navy/gold frame every deck column lives in.
 *
 * Navy field, a thick brass ring with soft shadow, a small-caps mono header
 * (optionally tinted with a column accent), and a flush body that holds the
 * white reading surfaces. Footer is for the source selectors / actions that
 * sit at the bottom of a column.
 */

export const NAVY = "#0c1b3d";
export const NAVY_DEEP = "#081530";
export const BRASS = "#c8a24b";
export const PARCHMENT = "#e6ecf7";

export function Panel({
  label,
  accent = BRASS,
  headerRight,
  footer,
  children,
  bodyClassName = "",
  className = "",
}: {
  label: ReactNode;
  accent?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] ${className}`}
      style={{
        background: NAVY,
        border: `2px solid ${BRASS}`,
        boxShadow:
          "0 0 0 1px rgba(200,162,75,0.35), 0 14px 34px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 py-2"
        style={{
          borderBottom: "1px solid rgba(200,162,75,0.28)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), transparent)",
        }}
      >
        <span
          aria-hidden
          className="h-3 w-1 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span
          className="text-[12px] font-semibold tracking-[0.28em] uppercase"
          style={{ color: accent, fontFamily: "var(--font-mono, 'Special Elite')" }}
        >
          {label}
        </span>
        {headerRight != null && <div className="ml-auto flex items-center gap-1">{headerRight}</div>}
      </header>

      <div className={`min-h-0 flex-1 overflow-hidden ${bodyClassName}`}>{children}</div>

      {footer != null && (
        <footer
          className="shrink-0 px-2.5 py-2"
          style={{
            borderTop: "1px solid rgba(200,162,75,0.28)",
            background: "linear-gradient(0deg, rgba(0,0,0,0.25), transparent)",
          }}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}

/** A bright-white reading surface to sit inside a Panel body. */
export function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-h-0 overflow-y-auto rounded-lg ${className}`}
      style={{
        background: "#ffffff",
        color: "var(--ink)",
        boxShadow: "inset 0 0 0 1px rgba(200,162,75,0.22)",
      }}
    >
      {children}
    </div>
  );
}
