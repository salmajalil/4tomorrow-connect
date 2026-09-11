const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_RADIUS = 120;
const SCENARIO_COLORS = ["#c9a256", "#7c93ad", "#c9713f"];

function axisPoint(index: number, total: number, radius: number) {
  const angle = -90 + (360 / total) * index;
  const rad = (angle * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export function RadarChart({
  axes,
  series,
}: {
  axes: string[];
  series: { label: string; values: number[] }[];
}) {
  if (axes.length < 3) return null;

  const rings = [2, 4, 6, 8, 10];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Comparaison des scénarios" className="mx-auto block w-full max-w-sm">
        {rings.map((ring) => {
          const points = axes.map((_, i) => axisPoint(i, axes.length, (ring / 10) * MAX_RADIUS));
          return (
            <polygon
              key={ring}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}

        {axes.map((axis, i) => {
          const p = axisPoint(i, axes.length, MAX_RADIUS);
          const labelP = axisPoint(i, axes.length, MAX_RADIUS + 22);
          return (
            <g key={axis}>
              <line x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1} />
              <text
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--muted)"
                fontSize={11}
                fontWeight={600}
              >
                {axis}
              </text>
            </g>
          );
        })}

        {series.map((s, si) => {
          const color = SCENARIO_COLORS[si % SCENARIO_COLORS.length];
          const points = s.values.map((v, i) => axisPoint(i, axes.length, (Math.max(0, Math.min(10, v)) / 10) * MAX_RADIUS));
          return (
            <polygon
              key={s.label}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={color}
              fillOpacity={0.15}
              stroke={color}
              strokeWidth={2}
            />
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((s, si) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SCENARIO_COLORS[si % SCENARIO_COLORS.length] }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
