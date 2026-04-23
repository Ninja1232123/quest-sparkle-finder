import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { searchAll, AGENCIES } from "@/data/topics";

type Props = { compact?: boolean; autoFocus?: boolean };

export function SearchBar({ compact = false, autoFocus = false }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const hits = useMemo(() => searchAll(q).slice(0, 8), [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setOpen(false);
    navigate({ to: "/search", search: { q: q.trim() } });
  }

  return (
    <div ref={wrapRef} className={`relative ${compact ? "w-full max-w-sm" : "w-full"}`}>
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={compact ? "Search across all sources…" : "Search rights, statutes, agencies — e.g. 'overtime', '§ 1692'"}
          className={`w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-4 font-display text-foreground placeholder:text-muted-foreground/80 shadow-[var(--shadow-soft)] transition-colors focus:border-foreground/40 focus:outline-none ${
            compact ? "h-10 text-sm" : "h-14 text-lg"
          }`}
        />
      </form>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-[var(--shadow-warm)]">
          {hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No matches in the index. Try a broader term — e.g. <em>eviction</em>, <em>warranty</em>, <em>1099</em>.
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
              {hits.map((h, i) => (
                <li key={i}>
                  <Link
                    to="/topic/$slug"
                    params={{ slug: h.topicSlug }}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/60"
                  >
                    <span
                      className="citation-tag mt-0.5 shrink-0 rounded-full border px-2 py-0.5"
                      style={{
                        color: h.agency ? AGENCIES[h.agency].color : "var(--muted-foreground)",
                        borderColor: h.agency ? AGENCIES[h.agency].color : "var(--border)",
                      }}
                    >
                      {h.kind === "topic" ? "topic" : h.kind === "term" ? "term" : AGENCIES[h.agency!].shortName}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-foreground">{h.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{h.detail}</div>
                    </div>
                    <span className="font-display text-xs italic text-muted-foreground">{h.topicTitle}</span>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={submit}
                  className="block w-full px-4 py-3 text-left font-display text-sm italic text-accent hover:bg-muted/60"
                >
                  See all results for "{q}" →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
