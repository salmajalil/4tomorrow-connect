"use client";

import { useState } from "react";
import { Eyebrow } from "@/components/eyebrow";

export interface RoadmapPhase {
  phase_name: string;
  start_date: string;
  end_date: string;
  deliverables: string[];
  actions: string[];
  kpis: string[];
  order_index: number;
}

const GANTT_COLORS = ["#c9a256", "#7c93ad", "#c9713f", "#7ea88a", "#b98a9a"];

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function Gantt({ phases }: { phases: RoadmapPhase[] }) {
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => a.order_index - b.order_index);
  const rangeStart = sorted[0].start_date;
  const rangeEnd = sorted.reduce((max, p) => (p.end_date > max ? p.end_date : max), sorted[0].end_date);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{rangeStart}</span>
        <span>{rangeEnd}</span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {sorted.map((phase, i) => {
          const offsetPct = (daysBetween(rangeStart, phase.start_date) / totalDays) * 100;
          const widthPct = Math.max(3, (daysBetween(phase.start_date, phase.end_date) / totalDays) * 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium text-ink" title={phase.phase_name}>
                {phase.phase_name}
              </span>
              <div className="relative h-6 flex-1 rounded bg-surface-2">
                <div
                  className="absolute top-0 h-6 rounded"
                  style={{
                    left: `${offsetPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: GANTT_COLORS[i % GANTT_COLORS.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center justify-between font-medium text-ink">
        <span>{label}</span>
        <span className="text-accent">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--accent)]"
      />
    </label>
  );
}

export function RoadmapView({
  trajectoryId,
  co2SliderLabel,
  phases,
  onGenerate,
  generating,
  error,
}: {
  trajectoryId: string;
  co2SliderLabel: string;
  phases: RoadmapPhase[];
  onGenerate: (params: {
    trajectoryId: string;
    startDate: string;
    priorityCost: number;
    priorityCo2: number;
    priorityRisk: number;
    prioritySpeed: number;
  }) => void;
  generating: boolean;
  error: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [priorityCost, setPriorityCost] = useState(50);
  const [priorityCo2, setPriorityCo2] = useState(50);
  const [priorityRisk, setPriorityRisk] = useState(50);
  const [prioritySpeed, setPrioritySpeed] = useState(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Roadmap</Eyebrow>
        <h2 className="mt-3 font-display text-2xl text-ink">Feuille de route co-construite</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-ink">Date de démarrage</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <Slider label="Maîtrise des coûts" value={priorityCost} onChange={setPriorityCost} />
        <Slider label={co2SliderLabel} value={priorityCo2} onChange={setPriorityCo2} />
        <Slider label="Réduction des risques" value={priorityRisk} onChange={setPriorityRisk} />
        <Slider label="Rapidité de mise en œuvre" value={prioritySpeed} onChange={setPrioritySpeed} />

        <button
          type="button"
          onClick={() =>
            onGenerate({ trajectoryId, startDate, priorityCost, priorityCo2, priorityRisk, prioritySpeed })
          }
          disabled={generating}
          className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
        >
          {generating ? "Génération..." : phases.length > 0 ? "Regénérer la roadmap" : "Générer la roadmap"}
        </button>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </div>

      {phases.length > 0 && (
        <>
          <Gantt phases={phases} />
          <div className="flex flex-col gap-3">
            {[...phases]
              .sort((a, b) => a.order_index - b.order_index)
              .map((phase, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-ink">{phase.phase_name}</h3>
                    <span className="text-xs text-muted">
                      {phase.start_date} → {phase.end_date}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Livrables</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-ink">
                        {phase.deliverables.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Actions</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-ink">
                        {phase.actions.map((a, j) => (
                          <li key={j}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">KPIs de sortie</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-ink">
                        {phase.kpis.map((k, j) => (
                          <li key={j}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
