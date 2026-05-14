import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { ArrowLeft, Pin, Trash2, Save } from "lucide-react";

type CaseRow = { id: string; name: string; description: string | null };
type CaseItem = {
  id: string;
  identifier: string;
  source_code: string | null;
  heading: string | null;
  section_label: string | null;
  note: string | null;
  tags: string[];
  pinned: boolean;
  created_at: string;
};

export const Route = createFileRoute("/cases/$caseId")({
  component: CaseDetail,
  head: () => ({
    meta: [
      { title: "Case · Marginalia" },
      {
        name: "description",
        content:
          "A private case folder with saved citations, pinned statutes, and your own research notes.",
      },
      { property: "og:title", content: "Case · Marginalia" },
      { property: "og:description", content: "Saved citations and notes for this case." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [items, setItems] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "login", redirect: `/cases/${caseId}` } });
  }, [user, authLoading, navigate, caseId]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: it }] = await Promise.all([
        supabase.from("cases").select("id, name, description").eq("id", caseId).maybeSingle(),
        supabase
          .from("case_items")
          .select("id, identifier, source_code, heading, section_label, note, tags, pinned, created_at")
          .eq("case_id", caseId)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      setCaseData(c as CaseRow | null);
      setName(c?.name ?? "");
      setDescription(c?.description ?? "");
      setItems((it ?? []) as CaseItem[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user, caseId]);

  async function saveMeta() {
    if (!name.trim()) return;
    await supabase
      .from("cases")
      .update({ name: name.trim(), description: description.trim() || null })
      .eq("id", caseId);
    setCaseData((c) => (c ? { ...c, name: name.trim(), description: description.trim() || null } : c));
    setEditingMeta(false);
  }

  async function deleteCase() {
    if (!confirm("Delete this case and all its bookmarks?")) return;
    await supabase.from("cases").delete().eq("id", caseId);
    navigate({ to: "/cases" });
  }

  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("case_items").update({ pinned: !pinned }).eq("id", id);
    setItems((arr) =>
      [...arr.map((i) => (i.id === id ? { ...i, pinned: !pinned } : i))].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      }),
    );
  }

  async function removeItem(id: string) {
    await supabase.from("case_items").delete().eq("id", id);
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  async function updateNote(id: string, note: string) {
    await supabase.from("case_items").update({ note: note || null }).eq("id", id);
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, note } : i)));
  }

  async function updateTags(id: string, tags: string[]) {
    await supabase.from("case_items").update({ tags }).eq("id", id);
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, tags } : i)));
  }

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted-foreground">Loading…</div>
        <SiteFooter />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="font-display text-2xl">Case not found</h1>
          <Link to="/cases" className="mt-4 inline-block underline">All cases</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link to="/cases" className="citation-tag text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          All cases
        </Link>

        {editingMeta ? (
          <div className="mt-3 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 w-full rounded-lg border border-foreground/15 bg-background px-3 font-display text-2xl font-semibold focus:border-foreground/40 focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you're tracking…"
              rows={2}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={saveMeta} className="rounded-full bg-foreground px-4 py-2 text-xs text-background">
                Save
              </button>
              <button onClick={() => setEditingMeta(false)} className="rounded-full border px-4 py-2 text-xs">
                Cancel
              </button>
              <button onClick={deleteCase} className="ml-auto rounded-full border border-destructive/40 px-4 py-2 text-xs text-destructive hover:bg-destructive/10">
                Delete case
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              <span className="ink-underline italic">{caseData.name}</span>
            </h1>
            {caseData.description && <p className="mt-2 text-foreground/75">{caseData.description}</p>}
            <button onClick={() => setEditingMeta(true)} className="mt-2 text-xs text-muted-foreground underline hover:text-foreground">
              Rename / edit
            </button>
          </>
        )}

        <div className="mt-10">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
              <div className="font-display text-lg">No bookmarks yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Open any document in <Link to="/code" className="underline">The Code</Link> and click "Add to case".
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <CaseItemCard
                  key={it.id}
                  item={it}
                  onPin={() => togglePin(it.id, it.pinned)}
                  onRemove={() => removeItem(it.id)}
                  onSaveNote={(n) => updateNote(it.id, n)}
                  onSaveTags={(t) => updateTags(it.id, t)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function CaseItemCard({
  item,
  onPin,
  onRemove,
  onSaveNote,
  onSaveTags,
}: {
  item: CaseItem;
  onPin: () => void;
  onRemove: () => void;
  onSaveNote: (n: string) => void;
  onSaveTags: (t: string[]) => void;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const [tagsText, setTagsText] = useState((item.tags ?? []).join(", "));
  const [dirty, setDirty] = useState(false);

  function save() {
    onSaveNote(note);
    onSaveTags(tagsText.split(",").map((t) => t.trim()).filter(Boolean));
    setDirty(false);
  }

  return (
    <li className={`rounded-2xl border bg-card p-5 ${item.pinned ? "ring-1 ring-accent/40" : ""}`}>
      <div className="flex items-start gap-3">
        <Link
          to="/code/$"
          params={{ _splat: item.identifier.replace(/^\//, "") }}
          className="min-w-0 flex-1"
        >
          <div className="citation-tag text-muted-foreground">
            {(item.source_code ?? "").toUpperCase()}{item.section_label ? ` · ${item.section_label}` : ""}
          </div>
          <div className="mt-1 font-display text-base font-semibold hover:underline">
            {item.heading || item.identifier}
          </div>
        </Link>
        <button
          onClick={onPin}
          className={`rounded-full p-2 ${item.pinned ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted"}`}
          aria-label={item.pinned ? "Unpin" : "Pin"}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setDirty(true); }}
          placeholder="Note to yourself…"
          rows={2}
          className="w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <input
            value={tagsText}
            onChange={(e) => { setTagsText(e.target.value); setDirty(true); }}
            placeholder="tags, comma, separated"
            className="h-9 flex-1 rounded-full border border-foreground/10 bg-background px-3 text-xs focus:border-foreground/40 focus:outline-none"
          />
          {dirty && (
            <button onClick={save} className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs text-background">
              <Save className="h-3 w-3" />
              Save
            </button>
          )}
        </div>
      </div>
    </li>
  );
}