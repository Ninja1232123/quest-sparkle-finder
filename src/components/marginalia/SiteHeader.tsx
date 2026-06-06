import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut, Sun, Moon, Sparkles, Menu, X, Scale } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { NAV_GROUPS, TOOLS, type NavGroup } from "@/lib/codebooks";

/* -----------------------------------------------------------
   § Brand mark — ink square with ochre section sign in Fraunces
   italic. Replaces the old sage→ink gradient block. Reads at any
   size and says "the law" without saying it.
   ----------------------------------------------------------- */
function BrandMark() {
  return (
    <div
      className="inline-flex items-center justify-center rounded-md shadow-inner"
      style={{
        width: 36,
        height: 36,
        background: "var(--ink)",
        boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 0 oklch(0 0 0 / 0.10)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 26,
          color: "var(--ochre)",
          lineHeight: 1,
          marginTop: -1,
        }}
      >
        §
      </span>
    </div>
  );
}

function NavGroupTab({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`cb-tab ${open ? "active" : ""}`}
        style={{ ["--c" as never]: group.accent }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.accent, opacity: 0.95 }}
          aria-hidden
        />
        {group.label}
        <ChevronDown
          className={`ml-0.5 h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background shadow-[var(--shadow-warm)]"
          role="menu"
        >
          <div
            className="rounded-t-xl px-4 pt-3 pb-2"
            style={{
              backgroundImage: `linear-gradient(135deg, ${group.accent}18 0%, transparent 65%)`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.accent }} />
              <span className="font-display text-sm font-semibold">{group.label}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/65">{group.tagline}</p>
          </div>
          <div className="border-t border-border/40 px-2 py-2">
            {group.items.map((it) => {
              const isSoon = it.status === "soon";
              return (
                <Link
                  key={it.href + it.label}
                  to={it.href as never}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] hover:bg-muted ${
                    isSoon ? "text-foreground/50" : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.accent, opacity: isSoon ? 0.4 : 0.95 }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{it.label}</span>
                  {isSoon && (
                    <span className="ml-auto shrink-0 rounded-full border border-ochre/40 bg-ochre/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ochre">
                      soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsMenu({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-sm text-foreground/70 hover:bg-muted hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Tools
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background p-2 shadow-[var(--shadow-warm)]"
          role="menu"
        >
          {TOOLS.filter((t) => !t.authRequired || signedIn).map((t) => (
            <Link
              key={t.href}
              to={t.href as never}
              className="flex items-start gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
            >
              <t.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60" />
              <div className="min-w-0">
                <div className="font-display text-[13px] font-semibold text-foreground">
                  {t.label}
                </div>
                <div className="text-xs leading-snug text-foreground/55">{t.description}</div>
              </div>
            </Link>
          ))}
          {signedIn && (
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
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

/* Secondary section links — folded into the primary row's right cluster so
   the header is two rows, not three. (Home = the logo; browsing lives in the
   codebook strip below.) */
const SECONDARY_LINKS = [
  { to: "/code", label: "Browse" },
  { to: "/cases", label: "My Cases" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/forum", label: "The Floor" },
  { to: "/about", label: "About" },
] as const;

/* -----------------------------------------------------------
   § Mobile nav — below lg the desktop nav rows are hidden, so the
   whole site (sections, codebooks, tools, sign-in/Pro) would be
   unreachable without this. A slide-in drawer reusing the exact
   same registries as the desktop nav, so they never drift.
   ----------------------------------------------------------- */
function MobileNavGroup({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 py-3 text-left"
        aria-expanded={open}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: group.accent }}
          aria-hidden
        />
        <span className="font-display text-[15px] font-semibold text-foreground">
          {group.label}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-2">
          {group.items.map((it) => {
            const isSoon = it.status === "soon";
            return (
              <Link
                key={it.href + it.label}
                to={it.href as never}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm ${
                  isSoon ? "text-foreground/45" : "text-foreground/80"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: it.accent, opacity: isSoon ? 0.4 : 0.95 }}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{it.label}</span>
                {isSoon && (
                  <span className="ml-auto shrink-0 rounded-full border border-ochre/40 bg-ochre/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ochre">
                    soon
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileNav({
  signedIn,
  loading,
  onSignOut,
  theme,
  onToggleTheme,
}: {
  signedIn: boolean;
  loading: boolean;
  onSignOut: () => void;
  theme: string;
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-0.5 flex items-center justify-center rounded-full p-1.5 text-[#9fabcb] hover:text-[#fbf6e8]"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Portaled to <body>: the header has backdrop-filter, which makes it the
          containing block for position:fixed children — so a drawer rendered in
          place would size to the header, not the viewport. The portal escapes it. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={close}
              aria-hidden
            />
            <div
              className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-background shadow-[var(--shadow-warm)]"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
            >
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <span className="font-display text-sm font-semibold text-foreground">Menu</span>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full p-1.5 text-foreground/60 hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-4 py-3">
                {/* Account / conversion actions — the part that was fully invisible on phones */}
                {!signedIn && !loading && (
                  <div className="flex flex-col gap-2 pb-3">
                    <Link
                      to="/subscribe"
                      onClick={close}
                      className="flex items-center justify-center gap-1.5 rounded-full bg-ochre px-4 py-2.5 font-display text-sm font-semibold text-[#1a1206]"
                    >
                      <Sparkles className="h-4 w-4" />
                      Go Pro · $5
                    </Link>
                    <Link
                      to="/auth"
                      search={{ mode: "login", redirect: undefined }}
                      onClick={close}
                      className="rounded-full border border-border/60 px-4 py-2.5 text-center text-sm text-foreground/80"
                    >
                      Sign in
                    </Link>
                  </div>
                )}
                {signedIn && (
                  <div className="flex flex-col gap-1 pb-2">
                    {/* My Cases is the primary signed-in destination — promote it
                      out of the generic section list into the account cluster. */}
                    <Link
                      to="/cases"
                      onClick={close}
                      className="flex items-center gap-2 rounded-md bg-ochre/10 px-3 py-2.5 text-sm font-semibold text-foreground"
                    >
                      <Scale className="h-4 w-4 text-ochre" />
                      My Cases
                    </Link>
                    <Link
                      to="/account"
                      onClick={close}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground/85"
                    >
                      My account
                    </Link>
                  </div>
                )}

                {/* Sections — the public SECONDARY_LINKS. When signed in, My Cases
                  is shown above, so drop it here to avoid a duplicate. */}
                <div className="border-t border-border/30 py-1">
                  {SECONDARY_LINKS.filter((it) => !(signedIn && it.to === "/cases")).map((it) => (
                    <Link
                      key={it.to}
                      to={it.to as never}
                      onClick={close}
                      className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground/85"
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>

                {/* The Library — codebook groups */}
                <div className="mt-2 border-t border-border/30 pt-2">
                  <div className="px-1 pb-1 font-display text-[11px] uppercase tracking-[0.18em] text-foreground/45">
                    The Library
                  </div>
                  {NAV_GROUPS.map((group) => (
                    <MobileNavGroup key={group.key} group={group} onNavigate={close} />
                  ))}
                </div>

                {/* Tools */}
                <div className="mt-2 border-t border-border/30 pt-2">
                  <div className="px-1 pb-1 font-display text-[11px] uppercase tracking-[0.18em] text-foreground/45">
                    Tools
                  </div>
                  {TOOLS.filter((t) => !t.authRequired || signedIn).map((t) => (
                    <Link
                      key={t.href}
                      to={t.href as never}
                      onClick={close}
                      className="flex items-start gap-2.5 rounded-md px-3 py-2.5"
                    >
                      <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/55" />
                      <div className="min-w-0">
                        <div className="font-display text-sm font-semibold text-foreground">
                          {t.label}
                        </div>
                        <div className="text-xs leading-snug text-foreground/55">
                          {t.description}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Footer: theme + support + (sign out) */}
                <div className="mt-2 flex items-center justify-between border-t border-border/30 pt-3">
                  <a href="mailto:support@self-law.org" className="text-xs text-foreground/60">
                    support@self-law.org
                  </a>
                  <div className="flex items-center gap-1">
                    {signedIn && (
                      <button
                        onClick={() => {
                          close();
                          onSignOut();
                        }}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-foreground/70"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    )}
                    <button
                      onClick={onToggleTheme}
                      className="rounded-full p-1.5 text-foreground/60 hover:text-foreground"
                      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body,
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
    <header className="am-header sticky top-0 z-40">
      <div className="am-flagstripe" />

      {/* Row 1 — brand · search · actions */}
      <div className="mx-auto flex max-w-[1900px] items-center gap-4 px-4 py-2.5 lg:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5">
          <BrandMark />
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight text-[#fbf6e8]">
              Marginalia
            </div>
            <div className="hidden font-display text-[11px] uppercase tracking-[0.18em] text-[#c8a24b]/80 sm:block">
              a citizen's law index
            </div>
          </div>
        </Link>

        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-2xl">
            <SearchBar compact />
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-0.5" aria-label="Sections">
          <div className="hidden items-center lg:flex">
            {SECONDARY_LINKS.map((it) => (
              <Link
                key={it.to}
                to={it.to as never}
                className="am-navlink"
                activeProps={{ "data-active": "true" } as never}
              >
                {it.label}
              </Link>
            ))}
            {/* Contact is a mailto, not a route — a real address so anyone can
                report an issue. Plain <a>, since TanStack Link is route-only. */}
            <a
              href="mailto:support@self-law.org"
              className="am-navlink"
              title="Email support — report an issue or ask a question"
            >
              support@self-law.org
            </a>
          </div>
          <span className="am-actions-sep hidden lg:block" aria-hidden />
          {!user && !loading && (
            <>
              <Link
                to="/auth"
                search={{ mode: "login", redirect: undefined }}
                className="hidden rounded-full px-3 py-1.5 text-sm text-[#c2cde6] hover:text-[#fbf6e8] sm:block"
              >
                Sign in
              </Link>
              <Link to="/subscribe" className="am-pro hidden sm:inline-flex">
                <Sparkles className="h-3.5 w-3.5" />
                Go Pro · $5
              </Link>
            </>
          )}
          <button
            onClick={toggle}
            className="ml-0.5 hidden items-center justify-center rounded-full p-1.5 text-[#9fabcb] hover:text-[#fbf6e8] lg:flex"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <MobileNav
            signedIn={!!user}
            loading={loading}
            onSignOut={signOut}
            theme={theme}
            onToggleTheme={toggle}
          />
        </nav>
      </div>

      {/* Row 2 — the corpora ("the law about everything, everywhere") */}
      <nav
        className="am-codebooks relative mx-auto hidden max-w-[1900px] items-center gap-2 px-4 lg:flex lg:px-6"
        aria-label="Codebooks"
      >
        <span className="am-codebooks-label hidden xl:inline-flex">★&nbsp;The&nbsp;Library</span>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {NAV_GROUPS.map((group) => (
            <NavGroupTab key={group.key} group={group} />
          ))}
        </div>
        <div className="shrink-0 border-l border-[rgba(200,162,75,0.25)] pl-2">
          <ToolsMenu signedIn={!!user} onSignOut={signOut} />
        </div>
      </nav>
    </header>
  );
}
