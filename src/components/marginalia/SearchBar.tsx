import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Lock, Sparkles } from "lucide-react";
import { searchDocuments } from "@/lib/documents.functions";
import { useSearchQuota } from "@/hooks/use-search-quota";
import { useAuth } from "@/hooks/use-auth";

const SOURCE_LABELS: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

type Hit = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string;
  exact?: boolean;
};

type Props = { compact?: boolean; autoFocus?: boolean };

export function SearchBar({ compact = false, autoFocus = false }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { remaining, blocked, isPro, consume, limit } = useSearchQuota();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchDocuments({ data: { q: term } });
        if (!cancelled) setHits((res.hits ?? []).slice(0, 8));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    if (!user) {
      setOpen(false);
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/search?q=${encodeURIComponent(q.trim())}` } });
      return;
    }
    if (blocked || !consume()) {
      setOpen(false);
      navigate({ to: "/subscribe" });
      return;
    }
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
          placeholder={
            compact
              ? "Search keywords or a citation…"
              : "Try 'due process', 'overtime', '15 USC 1692', or '29 CFR 1910.95'"
          }
          className={`w-full rounded-full border border-foreground/15 bg-background/90 pl-10 pr-4 font-display text-foreground placeholder:text-muted-foreground/80 shadow-[var(--shadow-soft)] transition-colors focus:border-foreground/40 focus:outline-none ${
            compact ? "h-10 text-sm" : "h-14 text-lg"
          }`}
        />
      </form>

      {user && !isPro && (
        <div className={`mt-1.5 flex items-center justify-between gap-2 px-2 text-[11px] ${blocked ? "text-destructive" : "text-muted-foreground"}`}>
          <span className="inline-flex items-center gap-1">
            {blocked ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {blocked
              ? `Daily free searches used (${limit}/${limit}).`
              : `${remaining} of ${limit} free searches left today.`}
          </span>
          <Link to="/subscribe" className="font-display italic text-accent hover:underline">
            Go unlimited →
          </Link>
        </div>
      )}

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-[var(--shadow-warm)]">
          {loading && hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No matches. Try a broader term — <em>due process</em>, <em>warranty</em>, <em>1692</em>, <em>oath</em>.
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.identifier}>
                  <Link
                    to="/code/$"
                    params={{ _splat: h.identifier.replace(/^\//, "") }}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/60"
                  >
                    <span className="citation-tag mt-0.5 shrink-0 rounded-full border border-foreground/20 px-2 py-0.5 text-foreground/70">
                      {SOURCE_LABELS[h.source_code] ?? h.source_code.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-foreground">
                        {h.heading ?? h.section_label ?? h.identifier}
                        {h.exact && (
                          <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                            exact
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[h.parent_label, h.section_label].filter(Boolean).join(" · ") || h.identifier}
                      </div>
                    </div>
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
