import { Link } from "@tanstack/react-router";
import { SearchBar } from "./SearchBar";
import { DevNoticeBanner } from "./DevNoticeBanner";
import { useAuth } from "@/hooks/use-auth";
import { BookMarked, LogOut, MessagesSquare, Library, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function SiteHeader() {
  const { user, signOut, loading } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <DevNoticeBanner />
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between md:py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="group flex items-center gap-2.5">
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
          <nav className="flex items-center gap-1 text-sm md:hidden">
            <Link
              to="/code"
              className="rounded-full bg-foreground px-3 py-1.5 text-background"
            >
              The Code
            </Link>
            <Link
              to="/forum"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              Floor
            </Link>
            <Link
              to="/stacks"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              Stacks
            </Link>
            {user && (
              <Link
                to="/cases"
                className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
                activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
              >
                Cases
              </Link>
            )}
          </nav>
        </div>

        <div className="flex flex-1 items-center gap-3 md:justify-end">
          <div className="hidden flex-1 md:block md:max-w-md">
            <SearchBar compact />
          </div>
          <div className="md:hidden">
            <SearchBar compact />
          </div>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link
              to="/code"
              className="rounded-full bg-foreground px-3.5 py-1.5 text-background hover:opacity-90"
              activeProps={{ className: "rounded-full bg-foreground px-3.5 py-1.5 text-background" }}
            >
              The Code
            </Link>
            <Link
              to="/forum"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              The Floor
            </Link>
            <Link
              to="/stacks"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              <Library className="h-3.5 w-3.5" />
              Stacks
            </Link>
            {user ? (
              <>
                <Link
                  to="/cases"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted text-foreground" }}
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  Cases
                </Link>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/60 hover:bg-muted hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            ) : !loading ? (
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              >
                Sign in
              </Link>
            ) : null}
            <Link
              to="/about"
              className="rounded-full px-3 py-1.5 text-foreground/60 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              About
            </Link>
            <button
              onClick={toggle}
              className="flex items-center justify-center rounded-full p-1.5 text-foreground/60 hover:bg-muted hover:text-foreground"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
