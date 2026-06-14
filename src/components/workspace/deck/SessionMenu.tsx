import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/workspace.functions";
import { Plus, Trash2, MessageSquare, Search, ChevronDown } from "lucide-react";

type Thread = { id: string; title: string; last_message_at: string };

/**
 * SessionMenu — the New/Resume session control, as a dropdown.
 *
 * Lives in the Assistant panel header (its most efficient home), freeing the
 * deck's full width for the source + issues columns. Self-contained: owns its
 * own thread list and create/delete. Portaled to <body> because the Panel
 * frame clips overflow, and positioned `fixed` off the trigger rect (the same
 * pattern Juri uses to dock under the header within the global zoom).
 */
export function SessionMenu({ currentId }: { currentId?: string }) {
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filter, setFilter] = useState("");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const refresh = () =>
    list().then((rows) => setThreads(rows as Thread[])).catch(() => setThreads([]));

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) });
    };
    place();
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function newSession() {
    const t = await create({ data: {} });
    if (t?.id) {
      setThreads((p) => [{ id: t.id, title: t.title, last_message_at: t.last_message_at }, ...p]);
      setOpen(false);
      navigate({ to: "/workspace/$threadId", params: { threadId: t.id } });
    }
  }

  async function removeThread(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this session?")) return;
    await del({ data: { threadId: id } });
    setThreads((p) => p.filter((t) => t.id !== id));
    if (currentId === id) navigate({ to: "/workspace" });
  }

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads;
    const now = Date.now();
    const DAY = 86400000;
    const groups: Record<string, Thread[]> = { Today: [], Yesterday: [], "This week": [], Older: [] };
    for (const t of filtered) {
      const age = now - new Date(t.last_message_at).getTime();
      if (age < DAY) groups.Today.push(t);
      else if (age < 2 * DAY) groups.Yesterday.push(t);
      else if (age < 7 * DAY) groups["This week"].push(t);
      else groups.Older.push(t);
    }
    return groups;
  }, [threads, filter]);

  const mono = "var(--font-mono, 'Special Elite')";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors"
        style={{
          borderColor: "rgba(200,162,75,0.4)",
          color: "#c8a24b",
          background: open ? "rgba(200,162,75,0.14)" : "transparent",
          fontFamily: mono,
        }}
        title="Sessions"
      >
        <MessageSquare className="h-3 w-3" /> Sessions
        <ChevronDown className="h-3 w-3" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 120ms" }} />
      </button>

      {open && pos != null && createPortal(
        <div
          ref={popRef}
          className="fixed z-[120] flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-[12px]"
          style={{
            top: pos.top,
            right: pos.right,
            background: "#0c1b3d",
            border: "2px solid #c8a24b",
            boxShadow: "0 0 0 1px rgba(200,162,75,0.35), 0 18px 40px -12px rgba(0,0,0,0.75)",
          }}
        >
          <div className="space-y-2 p-2.5">
            <button
              type="button"
              onClick={newSession}
              className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold"
              style={{ background: "#c8a24b", color: "#0c1b3d" }}
            >
              <Plus className="h-4 w-4" /> New session
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "rgba(230,236,247,0.5)" }} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter sessions…"
                className="w-full rounded-md border bg-transparent py-1.5 pl-7 pr-2 text-xs outline-none placeholder:opacity-60"
                style={{ borderColor: "rgba(200,162,75,0.25)", color: "#e6ecf7", fontFamily: mono }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {threads.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs" style={{ color: "rgba(230,236,247,0.55)", fontFamily: mono }}>
                No sessions yet
              </div>
            ) : (
              <div className="space-y-3">
                {(["Today", "Yesterday", "This week", "Older"] as const).map((label) =>
                  grouped[label].length === 0 ? null : (
                    <div key={label}>
                      <div className="px-2 pb-1 text-[9px] tracking-[0.3em]" style={{ color: "rgba(230,236,247,0.4)", fontFamily: mono }}>
                        {label.toUpperCase()}
                      </div>
                      <ul className="space-y-0.5">
                        {grouped[label].map((t) => {
                          const active = currentId === t.id;
                          return (
                            <li key={t.id}>
                              <Link
                                to="/workspace/$threadId"
                                params={{ threadId: t.id }}
                                onClick={() => setOpen(false)}
                                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                                style={{
                                  background: active ? "rgba(200,162,75,0.18)" : "transparent",
                                  color: active ? "#fff" : "#e6ecf7",
                                  borderLeft: active ? "2px solid #c8a24b" : "2px solid transparent",
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                <span className="flex-1 truncate" style={{ fontFamily: "var(--font-serif, 'Cinzel')", fontSize: 13 }}>
                                  {t.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => removeThread(t.id, e)}
                                  className="opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
                                  aria-label="Delete session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t p-2.5" style={{ borderColor: "rgba(200,162,75,0.2)", fontFamily: mono }}>
            <Link to="/cases" onClick={() => setOpen(false)} className="block text-[10px] tracking-wider opacity-60 hover:opacity-100" style={{ color: "#e6ecf7" }}>↳ CASEBOOK</Link>
            <Link to="/builder" onClick={() => setOpen(false)} className="block text-[10px] tracking-wider opacity-60 hover:opacity-100" style={{ color: "#e6ecf7" }}>↳ PLEADING BUILDER</Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
