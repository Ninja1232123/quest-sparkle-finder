import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { seedThreadFromHandoff } from "@/lib/workspace.functions";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * "Send to Workspace" — drop on any doc/case/section view to spin up a new
 * workspace thread seeded with that document as context. The model picks up
 * with the citation already in hand.
 */
export function SendToWorkspaceButton({
  identifier,
  citation,
  heading,
  excerpt,
  className = "",
  variant = "default",
}: {
  identifier: string;
  citation?: string;
  heading?: string | null;
  excerpt?: string;
  className?: string;
  variant?: "default" | "compact";
}) {
  const { user } = useAuth();
  const router = useRouter();
  const seed = useServerFn(seedThreadFromHandoff);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const label = citation ?? heading ?? identifier;
  const handoffText =
    `I'm researching **${label}** (\`${identifier}\`).\n\n` +
    (excerpt ? `> ${excerpt.slice(0, 800).replace(/\n+/g, "\n> ")}\n\n` : "") +
    `Please use \`fetch_document\` on \`${identifier}\` to read it in full, then help me reason about it.`;

  async function go() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await seed({
        data: {
          title: `Re: ${label}`.slice(0, 80),
          messages: [{ role: "user", parts: [{ type: "text", text: handoffText }] }],
        },
      });
      router.navigate({ to: "/workspace/$threadId", params: { threadId: res.threadId } });
    } catch (e) {
      console.error("[SendToWorkspace] failed:", e);
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={go}
        disabled={loading}
        title="Open in AI Workspace"
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50 ${className}`}
        style={{ borderColor: "rgba(0,0,0,0.15)" }}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Workspace
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 ${className}`}
      style={{ borderColor: "rgba(200,162,75,0.6)", background: "rgba(200,162,75,0.12)", color: "var(--ink, #0c1b3d)" }}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      Send to Workspace
    </button>
  );
}