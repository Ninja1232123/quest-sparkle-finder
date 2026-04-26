import { Link } from "@tanstack/react-router";
import { SearchBar } from "./SearchBar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
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
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              The Code
            </Link>
            <Link
              to="/library"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              Sources
            </Link>
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
              to="/"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeOptions={{ exact: true }}
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              Topics
            </Link>
            <Link
              to="/library"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              Sources
            </Link>
            <Link
              to="/code"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              The Code
            </Link>
            <Link
              to="/about"
              className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
            >
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
