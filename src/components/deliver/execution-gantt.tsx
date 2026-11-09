"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import { GanttTimeline } from "@/components/deliver/gantt-timeline";
import { isIsoDate, parseMilestones } from "@/lib/deliver-gantt-calc";
import type { RoadmapExecutionStatus, RoadmapPhaseEntry } from "@/types/database";

const GANTT_COLORS = ["#c8955a", "#7fb8c4", "#d48a6a", "#9cc08a", "#d9c3a5"];

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
  guidedInputs = {},
}: {
  transformationId: string;
  initialPhases: RoadmapPhaseEntry[];
  // Answers to the roadmap questionnaire saved on the roadmap deliverable
  // (deliverables.inputs) — milestones and target date are drawn on the axis.
  guidedInputs?: Record<string, string>;
}) {
  const { t, language } = useLanguage();
  const gantt = t.deliver.gantt;
  const STATUS_LABELS: Record<RoadmapExecutionStatus, string> = {
    upcoming: gantt.statusUpcoming,
    in_progress: gantt.statusInProgress,
    done: gantt.statusDone,
  };
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
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      setPhases(data.phases as RoadmapPhaseEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
    } finally {
      setRegenerating(false);
    }
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">{gantt.noRoadmap}</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const targetDate = isIsoDate(guidedInputs.targetEndDate?.trim()) ? guidedInputs.targetEndDate.trim() : null;

  return (
    <div className="flex flex-col gap-4">
      <GanttTimeline
        rows={sorted.map((phase) => ({
          key: phase.id,
          label: phase.phase_name,
          start: phase.start_date,
          end: phase.end_date,
          color: GANTT_COLORS[phase.order_index % GANTT_COLORS.length],
          barClassName:
            phase.execution_status === "done"
              ? "opacity-100"
              : phase.execution_status === "in_progress"
                ? "opacity-90 ring-2 ring-live"
                : "opacity-35",
        }))}
        milestones={parseMilestones(guidedInputs.milestones)}
        targetDate={targetDate}
        today={today}
        language={language}
        labels={{ today: gantt.today, target: gantt.target, milestones: gantt.milestones, undated: gantt.undatedMilestone }}
      />

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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{gantt.deliverables}</p>
                <ul className="mt-1 list-inside list-disc text-xs text-ink">
                  {phase.deliverables.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{gantt.actions}</p>
                <ul className="mt-1 list-inside list-disc text-xs text-ink">
                  {phase.actions.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{gantt.exitKpis}</p>
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
          <h3 className="text-sm font-semibold text-ink">{gantt.adjustRemaining}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SliderMini label={gantt.costControl} value={priorityCost} onChange={setPriorityCost} />
            <SliderMini label={gantt.co2} value={priorityCo2} onChange={setPriorityCo2} />
            <SliderMini label={gantt.riskReduction} value={priorityRisk} onChange={setPriorityRisk} />
            <SliderMini label={gantt.speed} value={prioritySpeed} onChange={setPrioritySpeed} />
          </div>
          <button
            type="button"
            onClick={regenerateRemaining}
            disabled={regenerating}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {regenerating ? gantt.adjusting : gantt.regenerate}
          </button>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
