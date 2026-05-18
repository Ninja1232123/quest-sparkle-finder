import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { adminListPosts, adminDeletePost } from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blog/")({
  component: AdminBlogList,
});

function AdminBlogList() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(adminListPosts);
  const deleteFn = useServerFn(adminDeletePost);
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["admin", "blog", "list"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  if (!loading && !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">Sign in required</h1>
          <Link to="/auth" search={{ mode: "login" }} className="mt-6 inline-block rounded-full bg-foreground px-4 py-2 text-sm text-background">
            Sign in
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  async function onDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await deleteFn({ data: { id } });
    if (!res.ok) alert(res.error ?? "Failed to delete");
    refetch();
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="citation-tag text-muted-foreground">admin · blog</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Posts</h1>
          </div>
          <button
            onClick={() => navigate({ to: "/admin/blog/$id", params: { id: "new" } })}
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
          >
            New post
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load (you must be the configured admin)."}
          </div>
        )}

        <div className="mt-8 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
          {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {data?.posts?.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No posts yet. Click "New post" to start.</div>
          )}
          {data?.posts?.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      p.published ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.published ? "Published" : "Draft"}
                  </span>
                  <span className="truncate font-display text-sm font-semibold">{p.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">/{p.slug} · updated {new Date(p.updated_at).toLocaleString()}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {p.published && (
                  <Link to="/blog/$slug" params={{ slug: p.slug }} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
                    View
                  </Link>
                )}
                <Link
                  to="/admin/blog/$id"
                  params={{ id: p.id }}
                  className="rounded-md bg-muted px-2.5 py-1 text-xs hover:bg-muted/80"
                >
                  Edit
                </Link>
                <button
                  onClick={() => onDelete(p.id, p.title)}
                  className="rounded-md px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}