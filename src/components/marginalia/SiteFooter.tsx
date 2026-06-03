// Site-wide footer. Old Glory dress (navy + gold + flag stripes) with the
// product's mottos up top, then the brand line and the load-bearing legal
// disclaimer. Self-contained colors (no .merica ancestor needed) so it reads
// the same on every page. "Rye" (western face) is loaded in styles.css.
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-4 border-[#c8a24b] bg-[#0a1a47] text-[#fbf6e8]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* motto band */}
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#c8a24b]">
            ★ &nbsp; the supreme law of the land &nbsp; ★
          </div>
          <div
            className="mt-2 text-[#e7cd7e] [text-shadow:1px_1px_0_#9c7c2e]"
            style={{ fontFamily: '"Rye", serif', fontSize: "clamp(24px, 3.8vw, 34px)" }}
          >
            Don't Tread on Me
          </div>
          <div className="mt-1.5 font-display text-[12px] uppercase tracking-[0.18em] text-[#aeb9d6]">
            E Pluribus Unum — out of many, one
          </div>
          <p className="mx-auto mt-4 max-w-xl font-serif text-[15px] italic text-[#cdd6ea]">
            "If you don't know your rights, you don't have any."
          </p>
        </div>

        {/* brand row */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center">
          <div className="font-display text-base text-[#fbf6e8]">Marginalia · a citizen's law index</div>
          <div className="max-w-xl text-sm text-[#aeb9d6]">
            A research desk, not legal advice. Always read the cited source before relying on a summary.
          </div>
        </div>

        {/* disclaimer (verbatim — legally load-bearing) */}
        <div className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-xs leading-relaxed text-[#aeb9d6]">
          <span className="citation-tag mr-2 text-[#e7cd7e]">disclaimer</span>
          Marginalia is a research index, not a law firm. Nothing on this site is legal,
          tax, or financial advice and no attorney–client relationship is formed by using
          it. Statutes, regulations, and case law change; summaries, search results, AI
          output, and member posts may be incomplete, out of date, or wrong. Any
          interpretation drawn from material on this site should be validated by a
          licensed attorney in your jurisdiction before you act on it.
        </div>
      </div>

      {/* flag stripes */}
      <div
        className="h-[13px]"
        style={{ background: "repeating-linear-gradient(90deg, #b22234 0 30px, #fbf6e8 30px 60px)" }}
      />
    </footer>
  );
}
