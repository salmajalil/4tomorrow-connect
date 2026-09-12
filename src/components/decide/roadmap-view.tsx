"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { parseJsonResponse } from "@/lib/parse-json-response";

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

// Gantt bars and phase cards cross-highlight on click/tap — the only
// interactivity that doesn't cost an AI call, unlike re-generating on every
// slider nudge would (a real risk after tonight's credits scare).
function Gantt({
  phases,
  activeIndex,
  onSelectPhase,
}: {
  phases: RoadmapPhase[];
  activeIndex: number | null;
  onSelectPhase: (index: number) => void;
}) {
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => a.order_index - b.order_index);
  const rangeStart = sorted[0].start_date;
  const rangeEnd = sorted.reduce((max, p) => (p.end_date > max ? p.end_date : max), sorted[0].end_date);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{rangeStart}</span>
        <span>
          {Math.round(totalDays / 7)} semaines au total — {rangeEnd}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {sorted.map((phase) => {
          const offsetPct = (daysBetween(rangeStart, phase.start_date) / totalDays) * 100;
          const widthPct = Math.max(3, (daysBetween(phase.start_date, phase.end_date) / totalDays) * 100);
          const isActive = activeIndex === phase.order_index;
          return (
            <button
              key={phase.order_index}
              type="button"
              onClick={() => onSelectPhase(phase.order_index)}
              className="flex items-center gap-3 text-left"
            >
              <span
                className={`w-28 shrink-0 truncate text-xs font-medium ${isActive ? "text-accent-strong" : "text-ink"}`}
                title={phase.phase_name}
              >
                {phase.phase_name}
              </span>
              <div className="relative h-6 flex-1 rounded bg-surface-2">
                <div
                  className={`absolute top-0 h-6 rounded transition-all ${isActive ? "ring-2 ring-accent-strong" : ""}`}
                  style={{
                    left: `${offsetPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: GANTT_COLORS[phase.order_index % GANTT_COLORS.length],
                  }}
                />
              </div>
            </button>
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
}: {
  trajectoryId: string;
  co2SliderLabel: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [priorityCost, setPriorityCost] = useState(50);
  const [priorityCo2, setPriorityCo2] = useState(50);
  const [priorityRisk, setPriorityRisk] = useState(50);
  const [prioritySpeed, setPrioritySpeed] = useState(50);

  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const phaseRefs = useRef<(HTMLDivElement | null)[]>([]);

  function selectPhase(index: number) {
    setActiveIndex(index);
    phaseRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/decide/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trajectoryId, startDate, priorityCost, priorityCo2, priorityRisk, prioritySpeed }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || "Une erreur est survenue.");
      setPhases(data.phases as RoadmapPhase[]);
      setActiveIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setGenerating(false);
    }
  }

  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

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
          onClick={generate}
          disabled={generating}
          className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
        >
          {generating ? "Génération..." : phases.length > 0 ? "Regénérer la roadmap" : "Générer la roadmap"}
        </button>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </div>

      {phases.length > 0 && (
        <>
          <Gantt phases={phases} activeIndex={activeIndex} onSelectPhase={selectPhase} />
          <div className="flex flex-col gap-3">
            {sortedPhases.map((phase, i) => (
              <div
                key={i}
                ref={(el) => {
                  phaseRefs.current[phase.order_index] = el;
                }}
                onClick={() => setActiveIndex(phase.order_index)}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  activeIndex === phase.order_index ? "border-accent bg-accent/5" : "border-border bg-surface"
                }`}
              >
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
