import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { Folder, Plus } from "lucide-react";

type CaseRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  updated_at: string;
  item_count?: number;
};

export const Route = createFileRoute("/cases/")({
  component: CasesIndex,
  head: () => ({
    meta: [
      { title: "My Cases · Marginalia" },
      {
        name: "description",
        content:
          "Your private case folders: organize saved citations, notes, and pinned sections from the federal codebooks.",
      },
      { property: "og:title", content: "My Cases · Marginalia" },
      { property: "og:description", content: "Organize saved citations and research notes by case." },
      { property: "og:url", content: "https://self-law.org/cases" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://self-law.org/cases" }],
  }),
});

function CasesIndex() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login", redirect: "/cases" } });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from("cases")
        .select("id, name, description, color, archived, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (!rows || cancel) {
        if (!cancel) setLoading(false);
        return;
      }
      // Get item counts in one query
      const ids = rows.map((r) => r.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: items } = await supabase
          .from("case_items")
          .select("case_id")
          .in("case_id", ids);
        for (const it of items ?? []) counts.set(it.case_id, (counts.get(it.case_id) ?? 0) + 1);
      }
      if (!cancel) {
        setCases(rows.map((r) => ({ ...r, item_count: counts.get(r.id) ?? 0 })));
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("cases")
      .insert({ user_id: user.id, name: newName.trim() })
      .select("id")
      .single();
    setCreating(false);
    if (!error && data) {
      setNewName("");
      navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted-foreground">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="citation-tag text-muted-foreground">your reading desk</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="ink-underline italic">Cases</span>
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          A Case is a personal binder. Drop citations into one, tag them, and leave yourself notes — the law you're
          actually working with, in one place.
        </p>

        <form onSubmit={createCase} className="mt-8 flex gap-2">
          <label htmlFor="new-case-name" className="sr-only">New case name</label>
          <input
            id="new-case-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name a new case — e.g. 'Landlord deposit dispute'"
            className="h-11 flex-1 rounded-full border border-foreground/15 bg-background px-5 font-display text-sm shadow-[var(--shadow-soft)] focus:border-foreground/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex h-11 items-center gap-2 rounded-full bg-foreground px-5 font-display text-sm text-background hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New case
          </button>
        </form>

        <div className="mt-10">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border bg-card/60" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
              <Folder className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-3 font-display text-lg">No cases yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one above, then bookmark sections from <Link to="/code" className="underline">The Code</Link>.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="citation-tag text-accent">{(c.item_count ?? 0).toLocaleString()} entries</div>
                    <div className="mt-1 font-display text-lg font-semibold">{c.name}</div>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-foreground/70">{c.description}</p>
                    )}
                    <div className="mt-3 text-xs text-muted-foreground">
                      Updated {new Date(c.updated_at).toLocaleDateString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}