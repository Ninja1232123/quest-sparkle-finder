import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SourceSummary } from "@/lib/documents.functions";
import { CORPUS_GROUPS, GROUP_ORDER, sourceMeta, type GroupKey } from "@/lib/source-groups";

type Props = {
  sources: SourceSummary[];
  collapsed?: boolean;
};

type GroupBucket = {
  key: GroupKey;
  items: SourceSummary[];
};

function bucketize(sources: SourceSummary[]): GroupBucket[] {
  const map = new Map<GroupKey, SourceSummary[]>();
  for (const s of sources) {
    const group = sourceMeta(s.code).group;
    const arr = map.get(group) ?? [];
    arr.push(s);
    map.set(group, arr);
  }
  return GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, items: map.get(k)! }));
}

function useOpenGroups(activeGroup: GroupKey | null): [Record<GroupKey, boolean>, (k: GroupKey) => void] {
  // Start with the same value on server and first client render to avoid
  // hydration mismatches. Load persisted state in an effect after mount.
  const [open, setOpen] = useState<Record<GroupKey, boolean>>(
    () => ({ federal: true }) as Record<GroupKey, boolean>,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("corpus-groups-open");
      if (raw) setOpen(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (activeGroup && !open[activeGroup]) {
      setOpen((o) => ({ ...o, [activeGroup]: true }));
    }
  }, [activeGroup, open]);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("corpus-groups-open", JSON.stringify(open)); } catch { /* ignore */ }
  }, [open, hydrated]);

  return [open, (k) => setOpen((o) => ({ ...o, [k]: !o[k] }))];
}

export function CorpusTree({ sources, collapsed = false }: Props) {
  const location = useLocation();
  const activeCode = (() => {
    const m = location.pathname.match(/^\/code\/source\/([^/]+)/);
    if (m) return m[1];
    const m2 = location.pathname.match(/^\/code\/((?:us\/)?[^/]+)/);
    return m2?.[1] ?? null;
  })();
  const activeGroup = activeCode ? sourceMeta(activeCode).group : null;
  const buckets = bucketize(sources);
  const [open, toggle] = useOpenGroups(activeGroup);

  if (collapsed) {
    return (
      <nav aria-label="Corpus" className="flex flex-col items-center gap-1 py-3">
        <Link
          to="/code"
          className="rounded-lg p-2 text-foreground/70 hover:bg-muted hover:text-foreground"
          title="All sources"
        >
          <CornerMarker />
        </Link>
        {buckets.map((b) => {
          const G = CORPUS_GROUPS[b.key];
          const Icon = G.icon;
          return (
            <button
              key={b.key}
              onClick={() => toggle(b.key)}
              className={`rounded-lg p-2 transition-colors ${
                activeGroup === b.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/60 hover:bg-muted hover:text-foreground"
              }`}
              title={`${G.label} · ${b.items.length}`}
              aria-label={G.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Corpus" className="px-3 py-4">
      <div className="citation-tag mb-3 px-2 text-muted-foreground">corpus</div>
      <Link
        to="/code"
        className="mb-3 flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
        activeOptions={{ exact: true }}
        activeProps={{ className: "mb-3 flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium bg-muted text-foreground" }}
      >
        <span>All sources</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {sources.reduce((n, s) => n + s.count, 0).toLocaleString()}
        </span>
      </Link>

      <ul className="space-y-1">
        {buckets.map((b) => {
          const G = CORPUS_GROUPS[b.key];
          const Icon = G.icon;
          const isOpen = !!open[b.key];
          return (
            <li key={b.key}>
              <button
                onClick={() => toggle(b.key)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-foreground/85 hover:bg-muted hover:text-foreground"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-foreground/50" /> : <ChevronRight className="h-3.5 w-3.5 text-foreground/50" />}
                  <Icon className="h-3.5 w-3.5 text-foreground/60" />
                  <span className="font-medium">{G.label}</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/70">{b.items.length}</span>
              </button>
              {isOpen && (
                <ul className="mt-0.5 space-y-px pl-7">
                  {b.items.map((s) => {
                    const meta = sourceMeta(s.code);
                    const isActive = activeCode === s.code;
                    return (
                      <li key={s.code}>
                        <Link
                          to="/code/source/$source"
                          params={{ source: s.code }}
                          className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                            isActive
                              ? "bg-foreground/8 text-foreground"
                              : "text-foreground/75 hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: meta.accent }}
                            />
                            <span className="truncate">{s.name}</span>
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/70 group-hover:text-foreground/60">
                            {s.count.toLocaleString()}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-border/60 pt-4">
        <div className="citation-tag mb-2 px-2 text-muted-foreground">on deck</div>
        <ul className="space-y-1 px-2 text-xs text-foreground/55">
          <li className="flex items-center justify-between"><span>50 state codes</span><span className="font-mono">soon</span></li>
          <li className="flex items-center justify-between"><span>Federal caselaw</span><span className="font-mono">soon</span></li>
          <li className="flex items-center justify-between"><span>Bills · Fed. Register</span><span className="font-mono">building</span></li>
        </ul>
      </div>
    </nav>
  );
}

function CornerMarker() {
  return (
    <span className="block h-4 w-4 rounded-sm bg-gradient-to-br from-[var(--terracotta)] to-[var(--ochre)]" aria-hidden />
  );
}
