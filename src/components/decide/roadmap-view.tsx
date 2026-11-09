"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import { DeliverableInputsForm } from "@/components/deliver/deliverables-tab";
import { GanttTimeline } from "@/components/deliver/gantt-timeline";
import { isIsoDate, parseMilestones } from "@/lib/deliver-gantt-calc";

export interface RoadmapPhase {
  phase_name: string;
  start_date: string;
  end_date: string;
  deliverables: string[];
  actions: string[];
  kpis: string[];
  order_index: number;
}

const GANTT_COLORS = ["#c8955a", "#7fb8c4", "#d48a6a", "#9cc08a", "#d9c3a5"];

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
  const { t, language } = useLanguage();
  const roadmap = t.decide.roadmap;
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
  // Guided path: the same questionnaire as Livrer's roadmap deliverable
  // (INPUT_FIELDS.roadmap). Skipping it keeps the original generation from
  // the diagnostic/scenario alone, unchanged.
  const [formOpen, setFormOpen] = useState(false);
  const [guidedInputs, setGuidedInputs] = useState<Record<string, string>>({});
  const [appliedInputs, setAppliedInputs] = useState<Record<string, string>>({});
  const phaseRefs = useRef<(HTMLDivElement | null)[]>([]);

  function selectPhase(index: number) {
    setActiveIndex(index);
    phaseRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function generate(inputs: Record<string, string>) {
    setGenerating(true);
    setError("");

    // Same mobile-network reality Decide's scenario/diagnostic generation
    // already accounts for: a long call can finish server-side while the
    // connection drops first, surfacing as a network-level TypeError rather
    // than a real server error (those come back with a JSON body). Only
    // that case gets an automatic retry.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("/api/decide/roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trajectoryId,
            startDate,
            priorityCost,
            priorityCo2,
            priorityRisk,
            prioritySpeed,
            guidedInputs: inputs,
          }),
        });
        const { data } = await parseJsonResponse(res);
        if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
        setPhases(data.phases as RoadmapPhase[]);
        setAppliedInputs(inputs);
        setFormOpen(false);
        setActiveIndex(null);
        setGenerating(false);
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setError(isNetworkError ? t.decide.networkErrorRetry : err instanceof Error ? err.message : t.common.anErrorOccurred);
        setGenerating(false);
        return;
      }
    }
  }

  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);
  // Weeks from the first start to the last end — date difference only.
  const totalWeeks =
    sortedPhases.length > 0
      ? Math.round(
          (Date.parse(sortedPhases.reduce((max, p) => (p.end_date > max ? p.end_date : max), sortedPhases[0].end_date)) -
            Date.parse(sortedPhases[0].start_date)) /
            (7 * 86_400_000)
        )
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>{roadmap.eyebrow}</Eyebrow>
        <h2 className="mt-3 font-display text-2xl text-ink">{roadmap.title}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-ink">{roadmap.startDate}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <Slider label={roadmap.costControl} value={priorityCost} onChange={setPriorityCost} />
        <Slider label={co2SliderLabel} value={priorityCo2} onChange={setPriorityCo2} />
        <Slider label={roadmap.riskReduction} value={priorityRisk} onChange={setPriorityRisk} />
        <Slider label={roadmap.speed} value={prioritySpeed} onChange={setPrioritySpeed} />

        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={generating}
            className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
          >
            {generating ? roadmap.generating : phases.length > 0 ? roadmap.regenerate : roadmap.generate}
          </button>
        )}
        {formOpen && (
          <div className="sm:col-span-2">
            <DeliverableInputsForm
              kind="roadmap"
              language={language}
              values={guidedInputs}
              onChange={(key, value) => setGuidedInputs((prev) => ({ ...prev, [key]: value }))}
              onSubmit={() => void generate(guidedInputs)}
              onSkip={() => void generate({})}
              onCancel={() => setFormOpen(false)}
              hasDocuments={false}
              submitting={generating}
              d={t.deliver.deliverables}
              excludeKeys={["startDate"]}
            />
          </div>
        )}
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </div>

      {phases.length > 0 && (
        <>
          <GanttTimeline
            rows={sortedPhases.map((phase) => ({
              key: String(phase.order_index),
              label: phase.phase_name,
              start: phase.start_date,
              end: phase.end_date,
              color: GANTT_COLORS[phase.order_index % GANTT_COLORS.length],
              barClassName: activeIndex === phase.order_index ? "ring-2 ring-accent-strong" : "",
              labelClassName: activeIndex === phase.order_index ? "text-accent-strong" : "text-ink",
              onClick: () => selectPhase(phase.order_index),
            }))}
            milestones={parseMilestones(appliedInputs.milestones)}
            targetDate={isIsoDate(appliedInputs.targetEndDate?.trim()) ? appliedInputs.targetEndDate.trim() : null}
            today={today}
            language={language}
            labels={{
              today: t.deliver.gantt.today,
              target: t.deliver.gantt.target,
              milestones: t.deliver.gantt.milestones,
              undated: t.deliver.gantt.undatedMilestone,
            }}
            footer={`${totalWeeks} ${roadmap.totalWeeks}`}
          />
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{roadmap.deliverables}</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-ink">
                      {phase.deliverables.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{roadmap.actions}</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-ink">
                      {phase.actions.map((a, j) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{roadmap.exitKpis}</p>
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
