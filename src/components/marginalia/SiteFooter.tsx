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
        <div className="mt-6 rounded-md border border-border/60 bg-background/40 px-4 py-3 text-[11px] leading-relaxed text-foreground/65">
          <span className="citation-tag mr-2 text-foreground/80">disclaimer</span>
          Marginalia is a research index, not a law firm. Nothing on this site is legal,
          tax, or financial advice and no attorney–client relationship is formed by using
          it. Statutes, regulations, and case law change; summaries, search results, AI
          output, and member posts may be incomplete, out of date, or wrong. Any
          interpretation drawn from material on this site should be validated by a
          licensed attorney in your jurisdiction before you act on it.
        </div>
      </div>
    </footer>
  );
}