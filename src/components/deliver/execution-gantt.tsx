"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { RoadmapExecutionStatus, RoadmapPhaseEntry } from "@/types/database";

const GANTT_COLORS = ["#c9a256", "#7c93ad", "#c9713f", "#7ea88a", "#b98a9a"];
const STATUS_LABELS: Record<RoadmapExecutionStatus, string> = {
  upcoming: "À venir",
  in_progress: "En cours",
  done: "Terminée",
};

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function SliderMini({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
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

// The "co-construit, hérité et étendu" Gantt — shown as the "Transformation
// Roadmap" deliverable's own detail view (not a 4th tab: the brief is
// explicit that Inputs/Deliverables/Control Tower are the only three).
// "Regenerate" here only refreshes phases still marked "upcoming" — see
// /api/deliver/roadmap/adjust for why that has to be a different endpoint
// from Decide's own roadmap route.
export function ExecutionGantt({
  transformationId,
  initialPhases,
}: {
  transformationId: string;
  initialPhases: RoadmapPhaseEntry[];
}) {
  const [phases, setPhases] = useState<RoadmapPhaseEntry[]>(initialPhases);
  const [priorityCost, setPriorityCost] = useState(50);
  const [priorityCo2, setPriorityCo2] = useState(50);
  const [priorityRisk, setPriorityRisk] = useState(50);
  const [prioritySpeed, setPrioritySpeed] = useState(50);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...phases].sort((a, b) => a.order_index - b.order_index);
  const hasUpcoming = sorted.some((p) => p.execution_status === "upcoming");

  async function updateStatus(phaseId: string, status: RoadmapExecutionStatus) {
    const patch: Partial<RoadmapPhaseEntry> = { execution_status: status };
    const today = new Date().toISOString().slice(0, 10);
    if (status === "in_progress") patch.actual_start_date = today;
    if (status === "done") patch.actual_end_date = today;
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)));
    await createClient().from("roadmap_phases").update(patch).eq("id", phaseId);
  }

  async function regenerateRemaining() {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/roadmap/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, priorityCost, priorityCo2, priorityRisk, prioritySpeed }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || "Une erreur est survenue.");
      setPhases(data.phases as RoadmapPhaseEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRegenerating(false);
    }
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">Aucune roadmap disponible — génère-en une dans Decide d&apos;abord.</p>;
  }

  const rangeStart = sorted[0].start_date;
  const rangeEnd = sorted.reduce((max, p) => (p.end_date > max ? p.end_date : max), sorted[0].end_date);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{rangeStart}</span>
          <span>{rangeEnd}</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {sorted.map((phase) => {
            const offsetPct = (daysBetween(rangeStart, phase.start_date) / totalDays) * 100;
            const widthPct = Math.max(3, (daysBetween(phase.start_date, phase.end_date) / totalDays) * 100);
            return (
              <div key={phase.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs font-medium text-ink" title={phase.phase_name}>
                  {phase.phase_name}
                </span>
                <div className="relative h-5 flex-1 rounded bg-surface-2">
                  <div
                    className={`absolute top-0 h-5 rounded ${
                      phase.execution_status === "done"
                        ? "opacity-100"
                        : phase.execution_status === "in_progress"
                          ? "opacity-90 ring-2 ring-live"
                          : "opacity-35"
                    }`}
                    style={{
                      left: `${offsetPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: GANTT_COLORS[phase.order_index % GANTT_COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((phase) => (
          <div key={phase.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">{phase.phase_name}</h3>
              <span className="text-xs text-muted">
                {phase.start_date} → {phase.end_date}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {(["upcoming", "in_progress", "done"] as RoadmapExecutionStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(phase.id, s)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    phase.execution_status === s
                      ? "bg-accent text-accent-ink"
                      : "border border-border text-muted hover:text-ink"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Livrables</p>
                <ul className="mt-1 list-inside list-disc text-xs text-ink">
                  {phase.deliverables.map((d, j) => (
                    <li key={j}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Actions</p>
                <ul className="mt-1 list-inside list-disc text-xs text-ink">
                  {phase.actions.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">KPIs de sortie</p>
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

      {hasUpcoming && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Réajuster les phases restantes</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SliderMini label="Maîtrise des coûts" value={priorityCost} onChange={setPriorityCost} />
            <SliderMini label="CO2 / durabilité" value={priorityCo2} onChange={setPriorityCo2} />
            <SliderMini label="Réduction des risques" value={priorityRisk} onChange={setPriorityRisk} />
            <SliderMini label="Rapidité" value={prioritySpeed} onChange={setPrioritySpeed} />
          </div>
          <button
            type="button"
            onClick={regenerateRemaining}
            disabled={regenerating}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {regenerating ? "Réajustement..." : "Regenerate"}
          </button>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
