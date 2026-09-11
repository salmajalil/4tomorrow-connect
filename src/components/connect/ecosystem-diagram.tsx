import type { MatchOutput } from "@/lib/matching";

const SIZE = 360;
const CENTER = SIZE / 2;
const NODE_RADIUS_FROM_CENTER = 128;
const CENTER_NODE_R = 46;

export function EcosystemDiagram({
  projectLabel,
  groups,
}: {
  projectLabel: string;
  groups: { category: MatchOutput["category"]; label: string; count: number }[];
}) {
  if (groups.length === 0) return null;

  const nodes = groups.map((group, i) => {
    // Start at the top (-90deg) and go clockwise, evenly spaced.
    const angle = -90 + (360 / groups.length) * i;
    const rad = (angle * Math.PI) / 180;
    const x = CENTER + NODE_RADIUS_FROM_CENTER * Math.cos(rad);
    const y = CENTER + NODE_RADIUS_FROM_CENTER * Math.sin(rad);
    const r = Math.min(30, 16 + group.count * 3.5);
    // Label anchors flip side depending on which half of the circle it's on,
    // so text never runs off the viewBox or overlaps the node.
    const textAnchor: "start" | "end" | "middle" =
      Math.cos(rad) > 0.2 ? "start" : Math.cos(rad) < -0.2 ? "end" : "middle";
    const labelX = x + (textAnchor === "start" ? r + 8 : textAnchor === "end" ? -(r + 8) : 0);
    const labelY = y + (Math.sin(rad) > 0.5 ? r + 16 : Math.sin(rad) < -0.5 ? -(r + 10) : 4);

    return { ...group, x, y, r, textAnchor, labelX, labelY };
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Écosystème connecté à ${projectLabel} : ${groups
          .map((g) => `${g.label} (${g.count})`)
          .join(", ")}`}
        className="mx-auto block w-full max-w-sm"
      >
        {nodes.map((node) => (
          <line
            key={`line-${node.category}`}
            x1={CENTER}
            y1={CENTER}
            x2={node.x}
            y2={node.y}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
        ))}

        <circle cx={CENTER} cy={CENTER} r={CENTER_NODE_R} fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={2} />
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={10}
          letterSpacing="0.08em"
        >
          TON PROJET
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={13}
          fontWeight={600}
        >
          {projectLabel.length > 16 ? `${projectLabel.slice(0, 15)}…` : projectLabel}
        </text>

        {nodes.map((node) => (
          <g key={node.category}>
            <circle cx={node.x} cy={node.y} r={node.r} fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={1.5} />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill="var(--accent-strong)" fontSize={13} fontWeight={700}>
              {node.count}
            </text>
            <text
              x={node.labelX}
              y={node.labelY}
              textAnchor={node.textAnchor}
              fill="var(--ink)"
              fontSize={11}
              fontWeight={600}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
