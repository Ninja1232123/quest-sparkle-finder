import type { LucideIcon } from "lucide-react";
import { Lock, Sparkles } from "lucide-react";

type Status = "live" | "building" | "soon" | "vision";

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  live: {
    label: "now live",
    tone: "border-accent/40 bg-accent/10 text-accent",
  },
  building: {
    label: "in the workshop",
    tone: "border-sage-deep/40 bg-sage-deep/10 text-sage-deep",
  },
  soon: {
    label: "coming soon",
    tone: "border-ochre/40 bg-ochre/10 text-ochre",
  },
  vision: {
    label: "on the wishlist",
    tone: "border-terracotta/40 bg-terracotta/10 text-terracotta",
  },
};

export function LockedBadge({ status = "soon" }: { status?: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`citation-tag inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${m.tone}`}>
      <Sparkles className="h-3 w-3" />
      {m.label}
    </span>
  );
}

/**
 * A "blacked-out, not-yet-unlocked" tile. Looks like a real feature card, but
 * dimmed, with a lock + status chip — so visitors see the shape of what's coming
 * without thinking it's already shipped.
 */
export function ComingSoonCard({
  icon: Icon,
  title,
  pitch,
  status = "soon",
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  pitch: string;
  status?: Status;
  className?: string;
}) {
  const isLive = status === "live";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl p-5 paper-grain transition-all ${
        isLive
          ? "border border-accent/25 bg-accent/5 hover:border-accent/40 hover:bg-accent/8"
          : "border border-dashed border-foreground/15 bg-card/40 hover:border-foreground/30 hover:bg-card/60"
      } ${className}`}
      aria-label={`${title} — ${STATUS_META[status].label}`}
    >
      {!isLive && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_45%,rgba(0,0,0,0.18)_100%)]" />
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-ochre/10 blur-2xl transition-opacity group-hover:opacity-70 opacity-40" />
        </>
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${isLive ? "border-accent/30 bg-accent/10 text-accent" : "border-foreground/15 bg-background/60 text-foreground/60"}`}>
                <Icon className="h-4 w-4" />
              </span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 bg-background/60 text-foreground/60">
                <Lock className="h-4 w-4" />
              </span>
            )}
            <LockedBadge status={status} />
          </div>
          {!isLive && <Lock className="h-3.5 w-3.5 text-foreground/30" />}
        </div>
        <h3 className={`mt-3 font-display text-base font-semibold ${isLive ? "text-foreground" : "text-foreground/85"}`}>
          {title}
        </h3>
        <p className={`mt-1.5 text-sm leading-relaxed ${isLive ? "text-foreground/70" : "text-foreground/55"}`}>
          {pitch}
        </p>
      </div>
    </div>
  );
}

/**
 * Strip header for sections of locked teasers. Keeps the "this is the vision"
 * framing consistent across pages.
 */
export function ComingSoonHeader({
  eyebrow = "what's next",
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-foreground/15 pb-4">
      <div>
        <div className="citation-tag flex items-center gap-1.5 text-ochre">
          <Sparkles className="h-3 w-3" />
          {eyebrow}
        </div>
        <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-foreground/65">{subtitle}</p>
        )}
      </div>
      <a
        href="/whitepaper"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Read the full plan →
      </a>
    </div>
  );
}