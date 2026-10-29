"use client";

import { BRICKS, type BrickKey } from "@/lib/ecosystem-bricks";

const SIZE = 380;
const CENTER = SIZE / 2;
const ORBIT = 132;
const CENTER_R = 50;

// The project at the centre, the five ecosystem bricks around it. Every
// brick is a button: tapping one filters the players below, and the link
// lights up — the ecosystem reads as connected, not as a list. Bricks with
// nobody in them stay drawn (dashed) so the client sees what is missing.
export function EcosystemDiagram({
  projectLabel,
  centerLabel,
  counts,
  labels,
  active,
  onSelect,
}: {
  projectLabel: string;
  centerLabel: string;
  counts: Record<BrickKey, number>;
  labels: Record<BrickKey, string>;
  active: BrickKey | null;
  onSelect: (key: BrickKey | null) => void;
}) {
  const nodes = BRICKS.map((b, i) => {
    const angle = -90 + (360 / BRICKS.length) * i;
    const rad = (angle * Math.PI) / 180;
    const x = CENTER + ORBIT * Math.cos(rad);
    const y = CENTER + ORBIT * Math.sin(rad);
    const count = counts[b.key];
    const r = count === 0 ? 20 : Math.min(32, 22 + count * 2.5);
    const below = Math.sin(rad) > 0.3;
    return { ...b, x, y, r, count, labelY: below ? y + r + 16 : y - r - 9 };
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-label={`${projectLabel} : ${nodes.map((n) => `${labels[n.key]} (${n.count})`).join(", ")}`}
      className="mx-auto block w-full max-w-md select-none"
    >
      {nodes.map((n) => {
        const lit = active === n.key;
        return (
          <line
            key={`l-${n.key}`}
            x1={CENTER}
            y1={CENTER}
            x2={n.x}
            y2={n.y}
            stroke={lit ? "var(--accent)" : "var(--border-strong)"}
            strokeWidth={lit ? 2 : 1}
            strokeDasharray={n.count === 0 ? "3 4" : undefined}
            className={n.count > 0 && !lit ? "eco-flow" : undefined}
          />
        );
      })}

      <g onClick={() => onSelect(null)} className="cursor-pointer">
        <circle cx={CENTER} cy={CENTER} r={CENTER_R} fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={1.5} />
        <text x={CENTER} y={CENTER - 6} textAnchor="middle" fill="var(--muted)" fontSize={9} letterSpacing="0.14em">
          {centerLabel.toUpperCase()}
        </text>
        <text x={CENTER} y={CENTER + 12} textAnchor="middle" fill="var(--ink)" fontSize={13} fontWeight={600}>
          {projectLabel.length > 15 ? `${projectLabel.slice(0, 14)}…` : projectLabel}
        </text>
      </g>

      {nodes.map((n) => {
        const lit = active === n.key;
        const dim = n.count === 0;
        return (
          <g
            key={n.key}
            role="button"
            tabIndex={0}
            aria-pressed={lit}
            aria-label={`${labels[n.key]} : ${n.count}`}
            onClick={() => onSelect(lit ? null : n.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(lit ? null : n.key);
              }
            }}
            className="cursor-pointer outline-none"
          >
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={lit ? "var(--accent)" : "var(--surface)"}
              stroke={dim ? "var(--border-strong)" : "var(--accent)"}
              strokeWidth={1.5}
              strokeDasharray={dim ? "3 3" : undefined}
            />
            <text
              x={n.x}
              y={n.y + 5}
              textAnchor="middle"
              fill={lit ? "var(--accent-ink)" : dim ? "var(--muted)" : "var(--accent-strong)"}
              fontSize={16}
              fontWeight={600}
            >
              {n.count}
            </text>
            <text
              x={n.x}
              y={n.labelY}
              textAnchor="middle"
              fill={lit ? "var(--accent-strong)" : dim ? "var(--muted)" : "var(--ink)"}
              fontSize={11}
              fontWeight={500}
            >
              {labels[n.key]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
