import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BookmarkPlus, Check, Plus } from "lucide-react";

type Props = {
  identifier: string;
  source_code: string;
  heading: string | null;
  section_label: string | null;
};

type CaseLite = { id: string; name: string };

export function AddToCaseButton({ identifier, source_code, heading, section_label }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [savedIn, setSavedIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const [{ data: cs }, { data: existing }] = await Promise.all([
        supabase.from("cases").select("id, name").eq("user_id", user.id).eq("archived", false).order("updated_at", { ascending: false }),
        supabase.from("case_items").select("case_id").eq("user_id", user.id).eq("identifier", identifier),
      ]);
      setCases((cs ?? []) as CaseLite[]);
      setSavedIn(new Set((existing ?? []).map((e) => e.case_id)));
      setLoading(false);
    })();
  }, [open, user, identifier]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function addTo(caseId: string) {
    if (!user || savedIn.has(caseId)) return;
    const { error } = await supabase.from("case_items").insert({
      case_id: caseId,
      user_id: user.id,
      identifier,
      source_code,
      heading,
      section_label,
    });
    if (!error) setSavedIn((s) => new Set([...s, caseId]));
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("cases")
      .insert({ user_id: user.id, name: newName.trim() })
      .select("id, name")
      .single();
    if (!error && data) {
      await supabase.from("case_items").insert({
        case_id: data.id,
        user_id: user.id,
        identifier,
        source_code,
        heading,
        section_label,
      });
      setCases((cs) => [data as CaseLite, ...cs]);
      setSavedIn((s) => new Set([...s, data.id]));
      setNewName("");
    }
    setCreating(false);
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        search={{ mode: "signup", redirect: typeof window !== "undefined" ? window.location.pathname : undefined }}
        className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground/80 hover:border-foreground/40 hover:text-foreground"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Save to case</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground/80 hover:border-foreground/40 hover:text-foreground"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Save to case</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border bg-card p-3 shadow-[var(--shadow-warm)]">
          <div className="citation-tag mb-2 text-muted-foreground">Add this section to…</div>
          {loading ? (
            <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
          ) : (
            <>
              <ul className="max-h-56 space-y-1 overflow-auto">
                {cases.length === 0 && (
                  <li className="px-2 py-3 text-xs text-muted-foreground">No cases yet — create one below.</li>
                )}
                {cases.map((c) => {
                  const saved = savedIn.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => addTo(c.id)}
                        disabled={saved}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${saved ? "text-muted-foreground" : "hover:bg-muted"}`}
                      >
                        <span className="truncate">{c.name}</span>
                        {saved && <Check className="h-3.5 w-3.5 text-accent" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <form onSubmit={createAndAdd} className="mt-2 flex gap-1 border-t pt-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New case name"
                  className="h-8 flex-1 rounded-lg border border-foreground/15 bg-background px-2 text-xs focus:border-foreground/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="flex items-center gap-1 rounded-lg bg-foreground px-2 text-xs text-background disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}