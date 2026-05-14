import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/marginalia/SiteHeader";
import { SiteFooter } from "@/components/marginalia/SiteFooter";
import { listStackItems, type StackItem } from "@/lib/stacks.functions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { FileText, FileArchive, BookOpen, BookOpenText } from "lucide-react";

export const Route = createFileRoute("/stacks")({
  component: StacksPage,
  head: () => ({
    meta: [
      { title: "The Stacks · Marginalia" },
      {
        name: "description",
        content:
          "Reference shelf — long-form PDFs, full chapters, and supporting documents for the rules in the Code.",
      },
      { property: "og:title", content: "The Stacks · Marginalia" },
      {
        property: "og:description",
        content: "Roam the back room. Source documents, treatises, and reference texts.",
      },
    ],
  }),
});

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function prettyName(n: string): string {
  let s = n.replace(/\.[a-z0-9]+$/i, "");
  s = s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function iconFor(mime: string) {
  if (mime === "application/pdf") return FileText;
  if (mime === "text/markdown") return BookOpen;
  if (mime.includes("zip") || mime.includes("rar")) return FileArchive;
  return FileText;
}

function categoryFor(name: string, mime: string): string {
  const n = name.toLowerCase();
  if (mime === "text/markdown" || n.endsWith(".md")) return "Chapters in plain text";
  if (n.includes("dictionary") || n.includes("dictionery")) return "Reference";
  if (n.includes("constitution")) return "Founding documents";
  if (mime.includes("zip") || mime.includes("rar")) return "Source archives";
  if (mime === "application/pdf") return "Long-form readings";
  return "Other";
}

function StacksPage() {
  const { user, loading } = useAuth();
  const list = useServerFn(listStackItems);
  const { data, isLoading } = useQuery({
    queryKey: ["stacks-list"],
    queryFn: () => list({ data: undefined as never }),
    enabled: !!user,
  });
  const items = data?.items ?? [];
  const error = data?.error ?? null;

  if (!loading && !user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <section className="mx-auto max-w-2xl px-6 py-32 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight">The Stacks</h1>
          <p className="mt-4 text-foreground/70">Sign in to browse the back room.</p>
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

  // Group by category
  const groups = new Map<string, StackItem[]>();
  for (const it of items) {
    const cat = categoryFor(it.name, it.mime);
    const arr = groups.get(cat) ?? [];
    arr.push(it);
    groups.set(cat, arr);
  }
  const ORDER = [
    "Founding documents",
    "Reference",
    "Chapters in plain text",
    "Long-form readings",
    "Other",
  ];
  const sortedGroups = ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!] as const);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 pt-20 pb-12 md:pt-32 md:pb-20">
        <div className="citation-tag text-muted-foreground">the back room</div>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-7xl">
          The Stacks
        </h1>
        <p className="mt-6 max-w-xl font-display text-lg italic text-foreground/70 md:text-xl">
          A long shelf. Roam it.
        </p>
        <p className="mt-4 max-w-xl text-sm text-foreground/65">
          Treatises, dictionaries, full chapter dumps, and source archives behind
          everything in the Code. Open one, sit with it, see what it actually says.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-32">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading the shelf…</div>
        )}

        <div className="space-y-20">
          {sortedGroups.map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-6 flex items-baseline gap-4">
                <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  {cat}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {list.length} {list.length === 1 ? "item" : "items"}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((it: StackItem) => {
                  const Icon = iconFor(it.mime);
                  return (
                    <li key={it.name}>
                      <Link
                        to="/stacks/view"
                        search={{ name: it.name }}
                        className="group flex w-full items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                      >
                        <div className="mt-0.5 rounded-md bg-foreground/5 p-2.5 text-foreground/70 group-hover:bg-foreground/10">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-base font-semibold leading-tight">
                            {prettyName(it.name)}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{fmtSize(it.size)}</span>
                            <span>·</span>
                            <span className="truncate">{it.name}</span>
                          </div>
                        </div>
                        <div className="self-center text-muted-foreground group-hover:text-foreground">
                          <BookOpenText className="h-4 w-4" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
