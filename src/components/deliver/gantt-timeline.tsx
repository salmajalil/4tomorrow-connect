"use client";

import {
  ganttOffsetPercent,
  ganttRange,
  monthTicks,
  type Milestone,
} from "@/lib/deliver-gantt-calc";

export type GanttRow = {
  key: string;
  label: string;
  start: string;
  end: string;
  color: string;
  // Extra classes on the bar (execution status opacity, active ring…).
  barClassName?: string;
  labelClassName?: string;
  onClick?: () => void;
};

export type GanttTimelineLabels = {
  today: string;
  target: string;
  milestones: string;
  undated: string;
};

function formatMonth(iso: string, language: "fr" | "en"): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

// A real Gantt: dated time axis (month gridlines), one bar per phase,
// today's line, the target end date and the committed milestones. Every
// position comes from src/lib/deliver-gantt-calc.ts — pure date math, the
// AI never places anything on this axis. Shared by Décider's roadmap
// (roadmap-view.tsx) and Livrer's execution Gantt (execution-gantt.tsx).
export function GanttTimeline({
  rows,
  milestones = [],
  targetDate = null,
  today,
  language,
  labels,
  footer,
}: {
  rows: GanttRow[];
  milestones?: Milestone[];
  targetDate?: string | null;
  today: string;
  language: "fr" | "en";
  labels: GanttTimelineLabels;
  footer?: string;
}) {
  const dated = milestones.filter((m): m is { name: string; date: string } => m.date !== null);
  const undated = milestones.filter((m) => m.date === null);
  const range = ganttRange(
    rows.map((r) => r.start),
    [...rows.map((r) => r.end), ...dated.map((m) => m.date), targetDate]
  );
  if (!range) return null;

  const ticks = monthTicks(range.start, range.end);
  const todayPct = ganttOffsetPercent(range.start, range.end, today);
  const targetPct = targetDate ? ganttOffsetPercent(range.start, range.end, targetDate) : null;

  // Vertical markers drawn across the bar area (month grid, today, target).
  const overlay = (
    <>
      {ticks.map((tick) => (
        <div
          key={tick}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-border"
          style={{ left: `${ganttOffsetPercent(range.start, range.end, tick) ?? 0}%` }}
        />
      ))}
      {targetPct !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-danger"
          style={{ left: `${targetPct}%` }}
        />
      )}
      {todayPct !== null && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-strong" style={{ left: `${todayPct}%` }} />
      )}
    </>
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>{range.start}</span>
        <span className="flex flex-wrap items-center justify-end gap-3">
          {todayPct !== null && (
            <span className="flex items-center gap-1">
              <span aria-hidden className="inline-block h-3 w-0.5 bg-accent-strong" />
              {labels.today}
            </span>
          )}
          {targetDate && (
            <span className="flex items-center gap-1">
              <span aria-hidden className="inline-block h-3 border-l-2 border-dashed border-danger" />
              {labels.target} {targetDate}
            </span>
          )}
          <span>{footer ? `${footer} — ${range.end}` : range.end}</span>
        </span>
      </div>

      {/* Month axis */}
      <div className="mt-2 flex items-end gap-3">
        <span className="w-24 shrink-0 sm:w-28" />
        <div className="relative h-4 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-muted"
              style={{ left: `${ganttOffsetPercent(range.start, range.end, tick) ?? 0}%` }}
            >
              {formatMonth(tick, language)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-2">
        {rows.map((row) => {
          const left = ganttOffsetPercent(range.start, range.end, row.start) ?? 0;
          const right = ganttOffsetPercent(range.start, range.end, row.end) ?? 100;
          const width = Math.max(2, right - left);
          const content = (
            <>
              <span
                className={`w-24 shrink-0 truncate text-left text-xs font-medium sm:w-28 ${row.labelClassName ?? "text-ink"}`}
                title={`${row.label} · ${row.start} → ${row.end}`}
              >
                {row.label}
              </span>
              <div className="relative h-6 flex-1 rounded bg-surface-2">
                {overlay}
                <div
                  className={`absolute top-0 h-6 rounded transition-all ${row.barClassName ?? ""}`}
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: row.color }}
                />
              </div>
            </>
          );
          return row.onClick ? (
            <button key={row.key} type="button" onClick={row.onClick} className="flex items-center gap-3">
              {content}
            </button>
          ) : (
            <div key={row.key} className="flex items-center gap-3">
              {content}
            </div>
          );
        })}

        {dated.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-medium text-muted sm:w-28">{labels.milestones}</span>
            <div className="relative h-6 flex-1">
              {overlay}
              {dated.map((m) => (
                <span
                  key={`${m.name}-${m.date}`}
                  title={`${m.name} · ${m.date}`}
                  aria-label={`${m.name} · ${m.date}`}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-ink bg-accent"
                  style={{ left: `${ganttOffsetPercent(range.start, range.end, m.date) ?? 0}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {milestones.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {dated.map((m) => (
            <li key={`${m.name}-${m.date}`}>
              <span aria-hidden className="mr-1 inline-block h-2 w-2 rotate-45 bg-accent" />
              <span className="text-ink">{m.name}</span> · {m.date}
            </li>
          ))}
          {undated.map((m) => (
            <li key={m.name}>
              <span aria-hidden className="mr-1 inline-block h-2 w-2 rotate-45 border border-muted" />
              <span className="text-ink">{m.name}</span> · {labels.undated}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
