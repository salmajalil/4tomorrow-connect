"use client";

import { canShowRadar } from "@/lib/decide-scenario-calc";
import { useLanguage } from "@/components/language-provider";

const SIZE = 380;
const CENTER = SIZE / 2;
const MAX_RADIUS = 115;
const SCENARIO_COLORS = ["#c8955a", "#7fb8c4", "#d48a6a"];
// Longest real axis label today is "CO2 / durabilité (ou équivalent)" (33
// chars) — at fontSize 10 that clips against the viewBox edge at the 0°/180°
// poles if rendered on one line (this is the "radars cassent sur mobile,
// labels coupés" bug the bar comparator was introduced to avoid). Wrapping
// into short lines keeps the full label readable instead of truncating it.
const MAX_LINE_CHARS = 14;

function axisPoint(index: number, total: number, radius: number) {
  const angle = -90 + (360 / total) * index;
  const rad = (angle * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

/** Greedy word-wrap for an SVG label: short lines instead of one long clipped string. */
export function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function RadarChart({
  axes,
  series,
}: {
  axes: string[];
  series: { label: string; values: number[]; veto?: boolean }[];
}) {
  const { t } = useLanguage();
  // D04 — "vue radar en option (≤ 6 critères)" : au-delà, le radar devient
  // illisible (axes trop serrés) ; le comparateur en barres reste la seule vue.
  if (!canShowRadar(axes.length)) return null;

  const rings = [2, 4, 6, 8, 10];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t.decide.scenarios.radarAriaLabel}
        className="mx-auto block w-full max-w-sm"
      >
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
          const labelP = axisPoint(i, axes.length, MAX_RADIUS + 26);
          const lines = wrapLabel(axis, MAX_LINE_CHARS);
          const startDy = -((lines.length - 1) * 0.55);
          return (
            <g key={axis}>
              <line x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={1} />
              <text x={labelP.x} y={labelP.y} textAnchor="middle" fill="var(--muted)" fontSize={10} fontWeight={600}>
                {lines.map((line, li) => (
                  <tspan key={line} x={labelP.x} dy={li === 0 ? `${startDy}em` : "1.1em"}>
                    {line}
                  </tspan>
                ))}
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
              fillOpacity={s.veto ? 0.05 : 0.15}
              stroke={color}
              strokeWidth={2}
              strokeOpacity={s.veto ? 0.5 : 1}
              strokeDasharray={s.veto ? "4 3" : undefined}
            />
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((s, si) => (
          <span
            key={s.label}
            className={`flex items-center gap-1.5 text-xs font-medium ${s.veto ? "text-muted line-through" : "text-ink"}`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SCENARIO_COLORS[si % SCENARIO_COLORS.length], opacity: s.veto ? 0.5 : 1 }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
