import { Eye, X, Loader2 } from "lucide-react";
import type { CorpusDoc } from "@/lib/workspace.functions";
import { Panel, Surface } from "./Panel";

/**
 * DocViewer — full-text reader that overlays the Sources column.
 *
 * When open, the same document `ref` is sent to the chat endpoint (see the
 * transport in workspace.$threadId.tsx), so the assistant reads exactly what
 * the user is reading and can comment on the clause in front of them. The
 * "Shared with assistant" badge makes that loop visible.
 */
export function DocViewer({
  doc,
  loading,
  onClose,
}: {
  doc: CorpusDoc | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Panel
      label="Reader"
      accent="#7aa2d8"
      className="w-full"
      headerRight={
        <>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold tracking-wider uppercase"
            style={{ background: "rgba(122,162,216,0.18)", color: "#bcd3f2", fontFamily: "var(--font-mono, 'Special Elite')" }}
            title="The assistant is reading this with you"
          >
            <Eye className="h-3 w-3" /> Shared with assistant
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded hover:bg-white/10"
            style={{ color: "#bcd3f2" }}
            title="Close reader"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      }
      bodyClassName="p-2.5"
    >
      <Surface className="h-full p-4">
        {loading || !doc ? (
          <div className="flex h-full items-center justify-center gap-2 text-[12px]" style={{ color: "rgba(12,27,61,0.5)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
          </div>
        ) : (
          <article>
            <div className="mb-0.5 text-[12px] font-semibold tracking-wider uppercase" style={{ color: "#7a5e16", fontFamily: "var(--font-mono, 'Special Elite')" }}>
              {[doc.court, doc.citation].filter(Boolean).join(" · ")}
            </div>
            {doc.heading && (
              <h2 className="mb-2 text-[16px] font-semibold leading-snug" style={{ color: "var(--ink)", fontFamily: "var(--font-serif, 'Cinzel')" }}>
                {doc.heading}
              </h2>
            )}
            <pre
              className="whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{ color: "var(--ink)", fontFamily: "var(--font-serif, Georgia, serif)" }}
            >
              {doc.body || "No text available for this document."}
            </pre>
          </article>
        )}
      </Surface>
    </Panel>
  );
}
