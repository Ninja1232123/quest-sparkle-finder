export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-paper-deep/40 mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="font-display text-base text-foreground">Marginalia</div>
            <div className="mt-1 italic">Notes from the law's margins. Not legal advice — just a friendlier first read.</div>
          </div>
          <div className="font-display text-xs italic">made with ink &amp; curiosity</div>
        </div>
      </div>
    </footer>
  );
}