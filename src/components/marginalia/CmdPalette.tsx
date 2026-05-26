/**
 * CmdPalette — global ⌘K (or Ctrl+K, or "/") search overlay.
 *
 * Two-pane: results list on the left, citation preview on the right.
 * Compare toggle routes Enter to /compare with a sensible default set of sources.
 * The keyword↔meaning slider is a real blend: its value (0-100) is passed to
 * searchDocuments as `semantic`, which weights search_hybrid's fusion (0 = pure
 * keyword FTS, 100 = pure semantic over the fastText vectors). It carries
 * through to /search when you open the full results page.
 *
 * Mounted once in __root.tsx so any page can trigger it via the keyboard.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search as SearchIcon,
  Columns,
  Sparkles,
  BookOpen,
  Bookmark,
  ChevronRight,
  Plus,
  Zap,
} from "lucide-react";
import { searchDocuments } from "@/lib/documents.functions";
import { useAuth } from "@/hooks/use-auth";
import { useSearchQuota } from "@/hooks/use-search-quota";
import { CODEBOOKS, codebookForSource } from "@/lib/codebooks";

const SOURCE_LABELS: Record<string, string> = {
  const: "Const.",
  usc: "U.S.C.",
  cfr: "C.F.R.",
  ucc: "U.C.C.",
  tfm: "TFM",
  irm: "IRM",
};

type Suggestion = { label: string; sub: string };
const SUGGESTIONS: Suggestion[] = [
  { label: "due process", sub: "concept · across 4 codebooks" },
  { label: "right to cure", sub: "concept · debt collection + UCC" },
  { label: "15 USC 1692", sub: "title · Fair Debt Collection Practices" },
  { label: "4th amendment", sub: "constitutional · search and seizure" },
  { label: "commercial paper", sub: "UCC Article 3 · negotiable instruments" },
];

type Hit = {
  identifier: string;
  source_code: string;
  parent_label: string | null;
  section_label: string | null;
  heading: string | null;
  snippet: string;
  exact?: boolean;
};

type Item =
  | { kind: "suggestion"; label: string; sub: string }
  | { kind: "hit"; hit: Hit };

function accentFor(source: string): string {
  return codebookForSource(source)?.accent ?? "#1A1814";
}

function stripMarks(s: string): string {
  return s.replace(/<\/?mark>/g, "");
}

export function CmdPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [semantic, setSemantic] = useState(60);
  const [compareMode, setCompareMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { blocked } = useSearchQuota();

  // Global open/close shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // "/" opens when not typing into a field
      if (e.key === "/" && !meta && !e.altKey) {
        const ae = document.activeElement;
        const typing =
          ae instanceof HTMLInputElement ||
          ae instanceof HTMLTextAreaElement ||
          (ae as HTMLElement | null)?.getAttribute("contenteditable") === "true";
        if (typing) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      setQ("");
      setActive(0);
      setHits([]);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchDocuments({ data: { q: term, semantic } });
        if (!cancelled) setHits(((res.hits as Hit[]) ?? []).slice(0, 8));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, semantic]);

  // Build items list
  const items: Item[] =
    q.trim().length < 2
      ? SUGGESTIONS.map((s) => ({ kind: "suggestion" as const, ...s }))
      : hits.map((h) => ({ kind: "hit" as const, hit: h }));

  // Keyboard nav inside palette
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = items[active];
        if (!it) {
          // No active item — submit raw query if there is one
          if (q.trim().length >= 2) submitQuery(q.trim());
          return;
        }
        if (it.kind === "suggestion") {
          setQ(it.label);
          setActive(0);
        } else {
          openHit(it.hit);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, active, q]);

  function submitQuery(term: string) {
    setOpen(false);
    if (compareMode) {
      navigate({ to: "/compare", search: { q: term, sources: "const,usc,cfr" } });
      return;
    }
    // Same gate as the SearchBar — pre-check only; /search does the consume.
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: `/search?q=${encodeURIComponent(term)}${semantic ? `&semantic=${semantic}` : ""}` } });
      return;
    }
    if (blocked) {
      navigate({ to: "/subscribe" });
      return;
    }
    navigate({ to: "/search", search: { q: term, semantic } });
  }

  function openHit(h: Hit) {
    setOpen(false);
    navigate({ to: "/code/$", params: { _splat: h.identifier.replace(/^\//, "") } });
  }

  if (!open) return null;

  const activeItem = items[active];

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)} role="dialog" aria-label="Search">
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        {/* LEFT — search + results */}
        <div className="cmd-left">
          <div className="cmd-search-row">
            <SearchIcon className="h-4 w-4 shrink-0 text-foreground/55" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search every codebook — or paste a citation…"
              aria-label="Search query"
            />
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`cmd-compare ${compareMode ? "on" : ""}`}
              aria-pressed={compareMode}
            >
              <Columns className="h-3 w-3" />
              {compareMode ? "Compare on" : "Compare"}
            </button>
          </div>

          <div className="cmd-slider-row">
            <span className="cmd-tag">match</span>
            <span className="cmd-slider-end">keyword</span>
            <input
              type="range"
              min={0}
              max={100}
              value={semantic}
              onChange={(e) => setSemantic(parseInt(e.target.value, 10))}
              aria-label="Match strength — keyword to meaning"
            />
            <span className="cmd-slider-end">meaning</span>
            <span className="cmd-slider-pct">{semantic}%</span>
          </div>

          <div className="cmd-results">
            <div className="cmd-section-label">
              {q.trim().length < 2 ? "Try one of these" : loading ? "Searching…" : "Matches"}
            </div>

            {q.trim().length >= 2 && !loading && hits.length === 0 ? (
              <div className="cmd-empty">Nothing on file matches that. Try a broader phrase.</div>
            ) : (
              items.map((it, i) => {
                const isActive = i === active;
                if (it.kind === "suggestion") {
                  return (
                    <div
                      key={`s-${i}`}
                      className={`cmd-item ${isActive ? "active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setQ(it.label);
                        setActive(0);
                      }}
                    >
                      <span className="cmd-suggest-ico">
                        <SearchIcon className="h-3 w-3" />
                      </span>
                      <div className="cmd-item-body">
                        <div className="cmd-item-title">{it.label}</div>
                        <div className="cmd-item-sub">{it.sub}</div>
                      </div>
                    </div>
                  );
                }
                const h = it.hit;
                const acc = accentFor(h.source_code);
                const label = SOURCE_LABELS[h.source_code] ?? h.source_code.toUpperCase();
                return (
                  <div
                    key={h.identifier}
                    className={`cmd-item ${isActive ? "active" : ""}`}
                    style={{ ["--c" as string]: acc } as React.CSSProperties}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openHit(h)}
                  >
                    <span className="cmd-pill">{label}</span>
                    <div className="cmd-item-body">
                      <div className="cmd-item-title">{h.heading ?? h.section_label ?? h.identifier}</div>
                      <div className="cmd-item-sub">
                        {[h.parent_label, h.section_label].filter(Boolean).join(" · ") || h.identifier}
                      </div>
                    </div>
                    {h.exact && <span className="cmd-exact">exact</span>}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                  </div>
                );
              })
            )}

            {q.trim().length >= 2 && hits.length > 0 && (
              <>
                <div className="cmd-section-label cmd-section-build">Build</div>
                <div
                  className="cmd-item cmd-build"
                  style={{ ["--c" as string]: "var(--terracotta)" } as React.CSSProperties}
                  onClick={() => submitQuery(q.trim())}
                >
                  <span className="cmd-pill cmd-pill-build">SEARCH</span>
                  <div className="cmd-item-body">
                    <div className="cmd-item-title">
                      See all results for "{q.trim()}"
                      {compareMode && <span className="cmd-compare-hint"> · in Compare</span>}
                    </div>
                    <div className="cmd-item-sub">
                      Open the full search page · annotate, export, save to a Case
                    </div>
                  </div>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-terracotta" />
                </div>
              </>
            )}
          </div>

          <div className="cmd-foot">
            <span><kbd>↑↓</kbd>navigate</span>
            <span><kbd>↵</kbd>open</span>
            <span><kbd>esc</kbd>close</span>
            <span className="cmd-foot-spacer" />
            <span className="cmd-foot-hint">
              <Zap className={`h-3 w-3 ${semantic > 0 ? "text-terracotta" : "text-foreground/30"}`} />
              {semantic > 0 ? `semantic ${semantic}%` : "keyword only"}
            </span>
          </div>
        </div>

        {/* RIGHT — preview pane */}
        <div className="cmd-preview">
          {activeItem?.kind === "hit" ? (
            <>
              <span
                className="pp-pill"
                style={{ backgroundColor: accentFor(activeItem.hit.source_code) }}
              >
                {SOURCE_LABELS[activeItem.hit.source_code] ?? activeItem.hit.source_code.toUpperCase()}
              </span>
              <div className="pp-title">
                {activeItem.hit.heading ?? activeItem.hit.section_label ?? activeItem.hit.identifier}
              </div>
              <div className="pp-cite">
                {[activeItem.hit.parent_label, activeItem.hit.section_label]
                  .filter(Boolean)
                  .join(" · ") || activeItem.hit.identifier}
              </div>
              <p className="pp-body">{stripMarks(activeItem.hit.snippet || "")}</p>
              <div className="pp-actions">
                <button type="button" className="cmd-btn-ink" onClick={() => openHit(activeItem.hit)}>
                  <BookOpen className="h-3.5 w-3.5" />
                  Open section
                </button>
                <button type="button" className="cmd-btn-paper">
                  <Bookmark className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </>
          ) : activeItem?.kind === "suggestion" ? (
            <div className="pp-empty">
              <Sparkles className="h-5 w-5 text-foreground/40" />
              <div className="pp-empty-title">{activeItem.label}</div>
              <div className="pp-empty-hint">
                Press <kbd>↵</kbd> to expand into a full search
              </div>
            </div>
          ) : (
            <div className="pp-empty">
              <SearchIcon className="h-5 w-5 text-foreground/40" />
              <div className="pp-empty-body">
                Type to search.
                <br />
                Hover or arrow to preview.
              </div>
              <div className="pp-empty-codebooks">
                {CODEBOOKS.filter((c) => c.status === "live")
                  .slice(0, 6)
                  .map((cb) => (
                    <span key={cb.slug} className="pp-cb-chip">
                      <span className="pp-cb-dot" style={{ backgroundColor: cb.accent }} />
                      {cb.tab}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
