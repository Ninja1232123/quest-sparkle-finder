import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { getStackSignedUrl } from "@/lib/stacks.functions";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";

const search = z.object({ name: z.string().min(1) });

export const Route = createFileRoute("/stacks/view")({
  validateSearch: (s) => search.parse(s),
  component: ViewerPage,
  head: () => ({
    meta: [{ title: "Reading · The Stacks · Marginalia" }],
  }),
});

function prettyName(n: string): string {
  let s = n.replace(/\.[a-z0-9]+$/i, "");
  s = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extOf(n: string) {
  return (n.toLowerCase().split(".").pop() ?? "").trim();
}

function ViewerPage() {
  const { name } = Route.useSearch();
  const { user, loading } = useAuth();
  const sign = useServerFn(getStackSignedUrl);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stacks-signed", name],
    queryFn: () => sign({ data: { name } }),
    enabled: !!user,
  });

  const url = data?.url ?? null;
  const ext = extOf(name);
  const isPdf = ext === "pdf";
  const isText = ext === "md" || ext === "txt";
  const isArchive = ext === "zip" || ext === "rar";

  const text = useQuery({
    queryKey: ["stacks-text", url],
    queryFn: async () => {
      if (!url) return "";
      const res = await fetch(url);
      return await res.text();
    },
    enabled: !!url && isText,
  });

  if (!loading && !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <section className="mx-auto max-w-2xl px-6 py-32 text-center">
          <h1 className="font-display text-3xl font-semibold">Sign in to read</h1>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Sign in
          </Link>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 pt-10 pb-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/stacks"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to the stacks
            </Link>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {prettyName(name)}
            </h1>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{name}</div>
          </div>
          {url && (
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </a>
              <a
                href={url}
                download={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          )}
        </div>

        {(isLoading || (!data && !error)) && (
          <div className="text-sm text-muted-foreground">Pulling it off the shelf…</div>
        )}
        {(error || data?.error) && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {data?.error ?? "Couldn't open this document."}
          </div>
        )}

        {url && isPdf && (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
            <iframe
              src={url}
              title={prettyName(name)}
              className="h-[80vh] w-full"
            />
          </div>
        )}

        {url && isText && (
          <article className="rounded-2xl border bg-card p-6 md:p-10 shadow-[var(--shadow-soft)]">
            {text.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading text…</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-display text-[15px] leading-relaxed text-foreground/90">
                {text.data}
              </pre>
            )}
          </article>
        )}

        {url && isArchive && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="text-sm text-foreground/80">
              This is an archive ({ext.toUpperCase()}). Download it to extract and read its
              contents.
            </p>
          </div>
        )}

        {url && !isPdf && !isText && !isArchive && (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-foreground/80">
            No inline preview for this file type. Use Open in new tab or Download above.
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
