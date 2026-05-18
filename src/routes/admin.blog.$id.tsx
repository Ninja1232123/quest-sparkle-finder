import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { adminGetPost, adminUpsertPost } from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blog/$id")({
  component: AdminBlogEditor,
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

type FormState = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_image_url: string;
  tags: string;
  author_name: string;
  seo_title: string;
  seo_description: string;
  published: boolean;
};

const EMPTY: FormState = {
  slug: "", title: "", excerpt: "", body_md: "", cover_image_url: "",
  tags: "", author_name: "", seo_title: "", seo_description: "", published: false,
};

function AdminBlogEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getFn = useServerFn(adminGetPost);
  const saveFn = useServerFn(adminUpsertPost);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (isNew || !user) return;
    getFn({ data: { id } }).then((res) => {
      if (res.post) {
        const p = res.post;
        setForm({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt ?? "",
          body_md: p.body_md ?? "",
          cover_image_url: p.cover_image_url ?? "",
          tags: (p.tags ?? []).join(", "),
          author_name: p.author_name ?? "",
          seo_title: p.seo_title ?? "",
          seo_description: p.seo_description ?? "",
          published: p.published,
        });
        setSlugTouched(true);
      } else if (res.error) {
        setErr(res.error);
      }
      setLoaded(true);
    }).catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setLoaded(true); });
  }, [id, isNew, user, getFn]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "title" && !slugTouched && isNew) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  async function save(publishNow?: boolean) {
    setErr(null);
    setSaving(true);
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await saveFn({
        data: {
          id: form.id,
          slug: form.slug,
          title: form.title,
          excerpt: form.excerpt || null,
          body_md: form.body_md,
          cover_image_url: form.cover_image_url || null,
          tags,
          published: publishNow ?? form.published,
          author_name: form.author_name || null,
          seo_title: form.seo_title || null,
          seo_description: form.seo_description || null,
        },
      });
      if (res.error) {
        setErr(res.error);
      } else if (res.id) {
        if (isNew) navigate({ to: "/admin/blog/$id", params: { id: res.id }, replace: true });
        else setForm((f) => ({ ...f, published: publishNow ?? f.published }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const previewHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(form.body_md || "", { async: false }) as string),
    [form.body_md],
  );

  if (!loading && !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">Sign in required</h1>
          <Link to="/auth" search={{ mode: "login" }} className="mt-6 inline-block rounded-full bg-foreground px-4 py-2 text-sm text-background">Sign in</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="min-h-screen"><SiteHeader /><div className="mx-auto max-w-3xl px-6 py-24 text-sm text-muted-foreground">Loading…</div><SiteFooter /></div>
    );
  }

  const labelCls = "block text-xs font-medium uppercase tracking-wider text-muted-foreground";
  const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/admin/blog" className="text-sm text-muted-foreground hover:text-foreground">← All posts</Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          {isNew ? "New post" : "Edit post"}
        </h1>

        {err && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</div>
        )}

        <div className="mt-6 space-y-5">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={200} />
          </div>

          <div>
            <label className={labelCls}>Slug (URL)</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/blog/</span>
              <input
                className={inputCls + " flex-1"}
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); update("slug", slugify(e.target.value)); }}
                maxLength={120}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Excerpt (shown on the blog index + social previews)</label>
            <textarea className={inputCls} rows={2} value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} maxLength={500} />
          </div>

          <div>
            <label className={labelCls}>Cover image URL (optional, used for social previews)</label>
            <input className={inputCls} value={form.cover_image_url} onChange={(e) => update("cover_image_url", e.target.value)} maxLength={800} placeholder="https://…" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Tags (comma-separated, max 10)</label>
              <input className={inputCls} value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="federal-register, primers" />
            </div>
            <div>
              <label className={labelCls}>Author name (optional)</label>
              <input className={inputCls} value={form.author_name} onChange={(e) => update("author_name", e.target.value)} maxLength={120} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls}>Body (Markdown)</label>
              <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs text-accent">
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div
                className="prose prose-neutral dark:prose-invert mt-2 max-w-none rounded-lg border border-border bg-card p-5"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <textarea
                className={inputCls + " font-mono text-sm"}
                rows={22}
                value={form.body_md}
                onChange={(e) => update("body_md", e.target.value)}
              />
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Markdown: <code>#</code> headings, <code>**bold**</code>, <code>*italic*</code>, <code>[link](url)</code>, <code>- list</code>, <code>&gt; quote</code>.
            </p>
          </div>

          <details className="rounded-lg border border-border/60 bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">SEO overrides (optional)</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={labelCls}>SEO title (defaults to post title)</label>
                <input className={inputCls} value={form.seo_title} onChange={(e) => update("seo_title", e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className={labelCls}>SEO description (defaults to excerpt)</label>
                <textarea className={inputCls} rows={2} value={form.seo_description} onChange={(e) => update("seo_description", e.target.value)} maxLength={300} />
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <button
              onClick={() => save(false)}
              disabled={saving || !form.title || !form.slug}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || !form.title || !form.slug}
              className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              {form.published ? "Update & republish" : "Publish"}
            </button>
            {form.published && !isNew && (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
              >
                Unpublish
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {saving ? "Saving…" : form.published ? "Published" : "Draft"}
            </span>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}