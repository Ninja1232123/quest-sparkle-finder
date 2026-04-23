import { AGENCIES } from "@/data/topics";

export function AgencyBadge({ id, size = "sm" }: { id: keyof typeof AGENCIES; size?: "sm" | "md" }) {
  const a = AGENCIES[id];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 citation-tag ${
        size === "md" ? "text-xs" : ""
      }`}
      style={{
        borderColor: a.color,
        color: a.color,
        backgroundColor: "color-mix(in oklab, var(--card), transparent 30%)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.color }} />
      {a.shortName}
    </span>
  );
}