import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDocument } from "@/lib/workspace.functions";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/workspace/doc/$id")({
  validateSearch: z.object({ format: z.enum(["md", "docx", "pdf"]).optional() }).parse,
  component: DocPage,
});

function DocPage() {
  const { id } = Route.useParams();
  const { format } = Route.useSearch();
  const get = useServerFn(getDocument);
  const navigate = useNavigate();
  const [doc, setDoc] = useState<{ id: string; title: string; kind: string; body_md: string } | null>(null);

  useEffect(() => {
    get({ data: { id } }).then((d) => setDoc(d as typeof doc)).catch(() => navigate({ to: "/workspace" }));
  }, [id, get, navigate]);

  useEffect(() => {
    if (!doc || !format) return;
    if (format === "md") {
      const blob = new Blob([doc.body_md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title.replace(/[^\w-]+/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "docx") {
      downloadDocx(doc);
    }
  }, [doc, format]);

  if (!doc) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-[0.25em] text-muted-foreground">{doc.kind}</div>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif, 'Cinzel')" }}>{doc.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadDocx(doc)}>
            <Download className="h-4 w-4" /> .docx
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/workspace/doc/$id", params: { id }, search: { format: "md" } })}>
            <Download className="h-4 w-4" /> .md
          </Button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap rounded-md border bg-background p-6 font-serif text-[15px] leading-relaxed">{doc.body_md}</pre>
    </div>
  );
}

async function downloadDocx(doc: { title: string; body_md: string }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const paragraphs = doc.body_md.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("# ")) {
      return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(trimmed.slice(2))] });
    }
    if (trimmed.startsWith("## ")) {
      return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(trimmed.slice(3))] });
    }
    return new Paragraph({ children: [new TextRun(trimmed)] });
  });
  const docx = new Document({
    sections: [{ children: [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.title)] }), ...paragraphs] }],
  });
  const blob = await Packer.toBlob(docx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[^\w-]+/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}