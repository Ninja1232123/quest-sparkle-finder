import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { CorpusTree } from "./CorpusTree";
import type { SourceSummary } from "@/lib/documents.functions";

type Props = {
  sources: SourceSummary[];
  children: ReactNode;
  /** Optional right-rail content (citation graph, related, definitions, facets). */
  right?: ReactNode;
  /** Optional label shown above right-rail content. */
  rightLabel?: string;
  /** Constrain the center reading column. Defaults to `max-w-3xl`. */
  centerMaxWidth?: string;
};

function usePersistedBool(key: string, fallback: boolean): [boolean, () => void] {
  const [v, setV] = useState<boolean>(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === "1";
    } catch { return fallback; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, v ? "1" : "0"); } catch { /* ignore */ }
  }, [key, v]);
  return [v, () => setV((x) => !x)];
}

export function ResearchShell({
  sources,
  children,
  right,
  rightLabel = "Connections",
  centerMaxWidth = "max-w-5xl",
}: Props) {
  // The corpus tree duplicates the header nav, so it's a closed-by-default
  // overlay drawer (fresh storage key resets everyone to closed).
  const [leftOpen, toggleLeft] = usePersistedBool("shell-left-open", false);
  const [rightOpen, toggleRight] = usePersistedBool("shell-right-open", true);

  const hasRight = !!right;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-[1900px] gap-0 px-0 lg:px-4">
        {/* Left corpus navigator — an OVERLAY drawer (closed by default) that
            layers above the content instead of reflowing it. Opened via the
            floating toggle; hidden via the close button or click-away. lg+ only
            (on smaller screens the header nav covers it). */}
        {!leftOpen && (
          <button
            onClick={toggleLeft}
            className="fixed left-2 top-[76px] z-40 hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground/70 shadow-[var(--shadow-soft)] backdrop-blur transition hover:text-foreground lg:inline-flex"
            aria-label="Open corpus navigator"
            title="Browse the full corpus"
          >
            <PanelLeftOpen className="h-4 w-4" /> Corpus
          </button>
        )}
        {leftOpen && (
          <>
            <button
              type="button"
              aria-label="Close corpus navigator"
              onClick={toggleLeft}
              className="fixed inset-x-0 bottom-0 top-[68px] z-30 hidden bg-foreground/5 lg:block"
            />
            <aside
              className="fixed bottom-0 left-0 top-[68px] z-40 hidden w-[300px] overflow-y-auto border-r border-border/60 bg-card shadow-[var(--shadow-warm)] lg:block"
              aria-label="Corpus navigation"
            >
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="citation-tag text-muted-foreground">Corpus</span>
                <button
                  onClick={toggleLeft}
                  className="rounded-md p-1.5 text-foreground/55 hover:bg-muted hover:text-foreground"
                  aria-label="Hide corpus navigator"
                  title="Hide"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
              <CorpusTree sources={sources} collapsed={false} />
            </aside>
          </>
        )}

        {/* Center pane */}
        <main className="min-w-0 flex-1">
          <div className={`mx-auto w-full ${centerMaxWidth} px-8 py-10`}>
            {children}
          </div>
        </main>

        {/* Right rail — connections, related, facets */}
        {hasRight && (
          <aside
            className={`hidden shrink-0 border-l border-border/60 transition-[width] duration-200 ease-out xl:block ${
              rightOpen ? "w-[360px]" : "w-[48px]"
            }`}
            aria-label={rightLabel}
          >
            <div className="sticky top-[68px] max-h-[calc(100vh-72px)] overflow-y-auto">
              <div className="flex items-center justify-between px-3 pt-2">
                {rightOpen ? (
                  <span className="citation-tag text-muted-foreground">{rightLabel}</span>
                ) : (
                  <span className="sr-only">{rightLabel}</span>
                )}
                <button
                  onClick={toggleRight}
                  className="rounded-md p-1.5 text-foreground/55 hover:bg-muted hover:text-foreground"
                  aria-label={rightOpen ? `Hide ${rightLabel}` : `Show ${rightLabel}`}
                  title={rightOpen ? `Hide ${rightLabel}` : `Show ${rightLabel}`}
                >
                  {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
              {rightOpen && <div className="px-3 pb-6 pt-3">{right}</div>}
            </div>
          </aside>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
