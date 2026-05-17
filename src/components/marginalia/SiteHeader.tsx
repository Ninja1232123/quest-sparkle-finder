import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./SearchBar";
import { DevNoticeBanner } from "./DevNoticeBanner";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut, Sun, Moon, Sparkles } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { CODEBOOKS, TOOLS, type Codebook } from "@/lib/codebooks";

function CodebookTab({ cb }: { cb: Codebook }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const isSoon = cb.status === "soon";

  return (
    <div
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <Link
        to={`/${cb.slug}` as never}
        className={`group flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-[13px] transition-colors ${
          isSoon
            ? "text-foreground/45 hover:text-foreground/70"
            : "text-foreground/75 hover:bg-muted hover:text-foreground"
        }`}
        activeProps={{ className: "rounded-md px-2.5 py-1.5 bg-muted text-foreground font-display text-[13px] font-semibold" }}
      >
        <span
          className="mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: cb.accent, opacity: isSoon ? 0.35 : 0.85 }}
          aria-hidden
        />
        {cb.tab}
        {isSoon && <Sparkles className="ml-0.5 h-2.5 w-2.5 text-ochre/70" aria-label="coming soon" />}
      </Link>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background shadow-[var(--shadow-warm)]"
          role="menu"
        >
          <div
            className="rounded-t-xl px-4 pt-3 pb-2"
            style={{ backgroundImage: `linear-gradient(135deg, ${cb.accent}18 0%, transparent 65%)` }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cb.accent }} />
              <span className="font-display text-sm font-semibold">{cb.name}</span>
              {isSoon && (
                <span className="ml-auto rounded-full border border-ochre/40 bg-ochre/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ochre">
                  soon
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/65">{cb.tagline}</p>
          </div>
          <div className="border-t border-border/40 px-2 py-2">
            <Link
              to={`/${cb.slug}` as never}
              className="block rounded-md px-3 py-2 text-xs text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              {isSoon ? "See what's planned →" : `Browse the ${cb.name} →`}
            </Link>
            {cb.quickLinks?.map((ql) => (
              <Link
                key={ql.href}
                to={ql.href as never}
                className="block rounded-md px-3 py-1.5 text-xs text-foreground/65 hover:bg-muted hover:text-foreground"
              >
                {ql.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsMenu({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } setOpen(true); };
  const onLeave = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-[13px] text-foreground/70 hover:bg-muted hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Tools
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background p-2 shadow-[var(--shadow-warm)]" role="menu">
          {TOOLS.filter((t) => !t.authRequired || signedIn).map((t) => (
            <Link
              key={t.href}
              to={t.href as never}
              className="flex items-start gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
            >
              <t.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60" />
              <div className="min-w-0">
                <div className="font-display text-xs font-semibold text-foreground">{t.label}</div>
                <div className="text-[11px] leading-snug text-foreground/55">{t.description}</div>
              </div>
            </Link>
          ))}
          {signedIn && (
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-md border-t border-border/40 px-3 py-2 pt-3 text-left hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5 text-foreground/60" />
              <span className="font-display text-xs text-foreground/75">Sign out</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, signOut, loading } = useAuth();
  const { theme, toggle } = useTheme();

  // Close hover panels when user scrolls or navigates (defensive — Link onClick
  // handles navigation, but a stuck panel on slow networks is jarring).
  const [, setTick] = useState(0);
  useEffect(() => {
    const onScroll = () => setTick((t) => t + 1);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <DevNoticeBanner />

      {/* Row 1 — brand, search, utility */}
      <div className="mx-auto flex max-w-[1900px] items-center gap-4 px-4 py-3 lg:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <div className="relative">
            <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[var(--sage-deep)] to-[var(--ink)] shadow-inner" />
            <div className="absolute inset-1 rounded-sm border border-background/30" />
          </div>
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight">Marginalia</div>
            <div className="font-display text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              a citizen's law index
            </div>
          </div>
        </Link>

        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-2xl">
            <SearchBar compact />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!user && !loading && (
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="hidden rounded-full px-3 py-1.5 text-sm text-foreground/70 hover:bg-muted hover:text-foreground sm:block"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={toggle}
            className="flex items-center justify-center rounded-full p-1.5 text-foreground/60 hover:bg-muted hover:text-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Row 2 — codebook tab strip + Tools dropdown */}
      <nav
        className="mx-auto flex max-w-[1900px] items-center gap-0.5 overflow-x-auto px-4 pb-2 lg:px-6"
        aria-label="Codebooks"
      >
        <div className="flex flex-1 items-center gap-0.5">
          {CODEBOOKS.map((cb) => (
            <CodebookTab key={cb.slug} cb={cb} />
          ))}
        </div>
        <div className="ml-2 shrink-0 border-l border-border/40 pl-2">
          <ToolsMenu signedIn={!!user} onSignOut={signOut} />
        </div>
      </nav>
    </header>
  );
}
