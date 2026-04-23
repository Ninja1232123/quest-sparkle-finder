import { useMemo, useState } from "react";
import { AGENCIES, type Topic } from "@/data/topics";

type Props = {
  topic: Topic;
  onSelect?: (citationId: string) => void;
  activeId?: string | null;
};

/**
 * Hand-drawn-feeling citation constellation.
 * Lays nodes out on a circle and draws curved ink lines between related rules.
 */
export function CitationMap({ topic, onSelect, activeId }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 720;
  const H = 520;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.36;

  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    topic.citations.forEach((c, i) => {
      const angle = (i / topic.citations.length) * Math.PI * 2 - Math.PI / 2;
      map[c.id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
    return map;
  }, [topic, cx, cy, radius]);

  const focused = activeId ?? hover;

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card paper-grain shadow-[var(--shadow-card)]">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        Hover a node to trace connections
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Citation map">
        <defs>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.92 0.13 95 / 0.6)" />
            <stop offset="100%" stopColor="oklch(0.92 0.13 95 / 0)" />
          </radialGradient>
          <filter id="rough">
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>

        {/* center label */}
        <circle cx={cx} cy={cy} r={70} fill="url(#halo)" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-ink"
          style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}
        >
          {topic.emoji}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}
        >
          {topic.title}
        </text>

        {/* edges */}
        {topic.connections.map((edge, i) => {
          const a = positions[edge.from];
          const b = positions[edge.to];
          if (!a || !b) return null;
          const isHot = focused && (focused === edge.from || focused === edge.to);
          const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.15;
          const my = (a.y + b.y) / 2 + (a.x - b.x) * 0.15;
          return (
            <g key={i}>
              <path
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                fill="none"
                stroke={isHot ? "var(--terracotta)" : "var(--sage-deep)"}
                strokeOpacity={isHot ? 0.9 : 0.25}
                strokeWidth={isHot ? 2 : 1.2}
                filter="url(#rough)"
                className="transition-all duration-300"
              />
              {isHot && (
                <text
                  x={mx}
                  y={my - 4}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 11 }}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {topic.citations.map((c) => {
          const p = positions[c.id];
          const agency = AGENCIES[c.agency];
          const isFocused = focused === c.id;
          return (
            <g
              key={c.id}
              transform={`translate(${p.x} ${p.y})`}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(c.id)}
              className="cursor-pointer"
            >
              <circle
                r={isFocused ? 36 : 30}
                fill="var(--card)"
                stroke={agency.color}
                strokeWidth={isFocused ? 3 : 2}
                className="transition-all duration-300"
                style={{ filter: isFocused ? "drop-shadow(0 6px 16px oklch(0.5 0.12 50 / 0.3))" : undefined }}
              />
              <text
                textAnchor="middle"
                y={-2}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, fill: agency.color }}
              >
                {agency.shortName}
              </text>
              <text
                textAnchor="middle"
                y={11}
                className="fill-foreground"
                style={{ fontFamily: "var(--font-display)", fontSize: 10 }}
              >
                {c.ref.split(/§|Part|Vol\.|Article/)[1]?.trim().slice(0, 10) ?? c.ref.slice(0, 10)}
              </text>
              {isFocused && (
                <foreignObject x={-110} y={42} width={220} height={80}>
                  <div className="rounded-lg border bg-background/95 px-3 py-2 text-center text-[11px] leading-snug text-foreground shadow-[var(--shadow-soft)] backdrop-blur">
                    <div className="font-display text-xs font-semibold">{c.title}</div>
                    <div className="mt-0.5 text-muted-foreground">{c.plain}</div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}