export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-paper-deep/40">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="font-display text-base text-foreground">Marginalia · a citizen's law index</div>
            <div className="mt-1 max-w-xl">
              A research desk, not legal advice. Always read the cited source before relying on a summary.
            </div>
          </div>
          <div className="font-display text-xs italic">
            "If you don't know your rights, you don't have any."
          </div>
        </div>
      </div>
    </footer>
  );
}