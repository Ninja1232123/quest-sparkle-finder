import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="relative">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--ochre)] to-[var(--terracotta)] shadow-inner transition-transform group-hover:rotate-12" />
            <div className="absolute inset-1 rounded-full border border-background/40" />
          </div>
          <div className="leading-none">
            <div className="font-display text-lg font-semibold tracking-tight">Marginalia</div>
            <div className="font-display text-[10px] italic text-muted-foreground">a friendlier law library</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
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
            to="/about"
            className="rounded-full px-3 py-1.5 text-foreground/70 hover:bg-muted hover:text-foreground"
            activeProps={{ className: "rounded-full px-3 py-1.5 bg-muted text-foreground" }}
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}