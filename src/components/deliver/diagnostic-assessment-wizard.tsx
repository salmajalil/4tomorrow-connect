"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";

export const OBJECTIVE_KEYS = [
  "costReduction",
  "operationalExcellence",
  "digitalTransformation",
  "technicalTransformation",
  "sustainability",
  "growth",
  "resilience",
] as const;
export type ObjectiveKey = (typeof OBJECTIVE_KEYS)[number];

export const TIMELINE_KEYS = ["3to6", "6to12", "12to18", "18to36", "36plus"] as const;
export type TimelineKey = (typeof TIMELINE_KEYS)[number];

export const SCALE_KEYS = ["singleSite", "regional", "national", "global"] as const;
export type ScaleKey = (typeof SCALE_KEYS)[number];

export const LEVEL3_KEYS = ["low", "medium", "high"] as const;
export type Level3Key = (typeof LEVEL3_KEYS)[number];

export const LEVEL4_KEYS = ["low", "medium", "high", "critical"] as const;
export type Level4Key = (typeof LEVEL4_KEYS)[number];

function objectiveLabel(w: Dictionary["deliver"]["wizard"], key: ObjectiveKey): string {
  const map: Record<ObjectiveKey, string> = {
    costReduction: w.objectiveCostReduction,
    operationalExcellence: w.objectiveOperationalExcellence,
    digitalTransformation: w.objectiveDigitalTransformation,
    technicalTransformation: w.objectiveTechnicalTransformation,
    sustainability: w.objectiveSustainability,
    growth: w.objectiveGrowth,
    resilience: w.objectiveResilience,
  };
  return map[key];
}

function objectiveDesc(w: Dictionary["deliver"]["wizard"], key: ObjectiveKey): string {
  const map: Record<ObjectiveKey, string> = {
    costReduction: w.objectiveCostReductionDesc,
    operationalExcellence: w.objectiveOperationalExcellenceDesc,
    digitalTransformation: w.objectiveDigitalTransformationDesc,
    technicalTransformation: w.objectiveTechnicalTransformationDesc,
    sustainability: w.objectiveSustainabilityDesc,
    growth: w.objectiveGrowthDesc,
    resilience: w.objectiveResilienceDesc,
  };
  return map[key];
}

function timelineLabel(w: Dictionary["deliver"]["wizard"], key: TimelineKey): string {
  const map: Record<TimelineKey, string> = {
    "3to6": w.timeline3to6,
    "6to12": w.timeline6to12,
    "12to18": w.timeline12to18,
    "18to36": w.timeline18to36,
    "36plus": w.timeline36plus,
  };
  return map[key];
}

function scaleLabel(w: Dictionary["deliver"]["wizard"], key: ScaleKey): string {
  const map: Record<ScaleKey, string> = {
    singleSite: w.scaleSingleSite,
    regional: w.scaleRegional,
    national: w.scaleNational,
    global: w.scaleGlobal,
  };
  return map[key];
}

function levelLabel(w: Dictionary["deliver"]["wizard"], key: Level3Key | Level4Key): string {
  const map: Record<Level4Key, string> = {
    low: w.levelLow,
    medium: w.levelMedium,
    high: w.levelHigh,
    critical: w.levelCritical,
  };
  return map[key];
}

interface WizardState {
  organization: string;
  industry: string;
  scope: string;
  currentState: string;
  targetState: string;
  primaryObjective: ObjectiveKey | null;
  secondaryObjectives: ObjectiveKey[];
  timelineHorizon: TimelineKey | null;
  scaleOfOperations: ScaleKey | null;
  digitalMaturity: Level3Key | null;
  assetCriticality: Level4Key | null;
  regulatoryPressure: Level3Key | null;
  kpis: string[];
}

const INITIAL_STATE: WizardState = {
  organization: "",
  industry: "",
  scope: "",
  currentState: "",
  targetState: "",
  primaryObjective: null,
  secondaryObjectives: [],
  timelineHorizon: null,
  scaleOfOperations: null,
  digitalMaturity: null,
  assetCriticality: null,
  regulatoryPressure: null,
  kpis: [],
};

function OptionButton({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
        selected
          ? "border-accent bg-accent/10 text-accent-strong"
          : "border-border text-ink hover:border-accent/50"
      }`}
    >
      <span className="font-semibold">{label}</span>
      {desc && <span className="text-xs text-muted">{desc}</span>}
    </button>
  );
}

export function DiagnosticAssessmentWizard({ onCancel }: { onCancel: () => void }) {
  const { t } = useLanguage();
  const w = t.deliver.wizard;
  const intake = t.decide.intake;
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [kpiDraft, setKpiDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = 5;

  function addKpi() {
    const trimmed = kpiDraft.trim();
    if (trimmed && !state.kpis.includes(trimmed)) {
      setState((s) => ({ ...s, kpis: [...s.kpis, trimmed] }));
    }
    setKpiDraft("");
  }

  async function handleComplete() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/manual-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      router.push(`/deliver?transformationId=${data.transformationId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
      setSubmitting(false);
    }
  }

  const canLeaveStep1 = state.scope.trim() || state.currentState.trim();

  return (
    <div className="mt-6 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink">{w.title}</h2>
        <span className="shrink-0 text-xs font-semibold text-muted">
          {step}/{totalSteps}
        </span>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{w.step1Title}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">{intake.organization}</span>
              <input
                value={state.organization}
                onChange={(e) => setState((s) => ({ ...s, organization: e.target.value }))}
                placeholder={intake.organizationPlaceholder}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">{intake.industry}</span>
              <input
                value={state.industry}
                onChange={(e) => setState((s) => ({ ...s, industry: e.target.value }))}
                placeholder={intake.industryPlaceholder}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.scopeLabel}</span>
            <textarea
              value={state.scope}
              onChange={(e) => setState((s) => ({ ...s, scope: e.target.value }))}
              placeholder={w.scopePlaceholder}
              rows={2}
              className="resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.currentStateLabel}</span>
            <textarea
              value={state.currentState}
              onChange={(e) => setState((s) => ({ ...s, currentState: e.target.value }))}
              placeholder={w.currentStatePlaceholder}
              rows={3}
              className="resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{w.step2Title}</h3>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.targetStateLabel}</span>
            <textarea
              value={state.targetState}
              onChange={(e) => setState((s) => ({ ...s, targetState: e.target.value }))}
              placeholder={w.targetStatePlaceholder}
              rows={3}
              className="resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.primaryObjectiveLabel}</span>
            <span className="text-xs text-muted">{w.primaryObjectiveHint}</span>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OBJECTIVE_KEYS.map((key) => (
                <OptionButton
                  key={key}
                  selected={state.primaryObjective === key}
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      primaryObjective: key,
                      secondaryObjectives: s.secondaryObjectives.filter((k) => k !== key),
                    }))
                  }
                  label={objectiveLabel(w, key)}
                  desc={objectiveDesc(w, key)}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.secondaryObjectivesLabel}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {OBJECTIVE_KEYS.filter((key) => key !== state.primaryObjective).map((key) => {
                const selected = state.secondaryObjectives.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        secondaryObjectives: selected
                          ? s.secondaryObjectives.filter((k) => k !== key)
                          : [...s.secondaryObjectives, key],
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border text-muted hover:text-ink"
                    }`}
                  >
                    {objectiveLabel(w, key)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{w.step3Title}</h3>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.timelineLabel}</span>
            <div className="flex flex-wrap gap-2">
              {TIMELINE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, timelineHorizon: key }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    state.timelineHorizon === key
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {timelineLabel(w, key)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.scaleLabel}</span>
            <div className="flex flex-wrap gap-2">
              {SCALE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, scaleOfOperations: key }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    state.scaleOfOperations === key
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {scaleLabel(w, key)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">{w.maturityLabel}</span>
              <div className="flex flex-wrap gap-2">
                {LEVEL3_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, digitalMaturity: key }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      state.digitalMaturity === key
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border text-muted hover:text-ink"
                    }`}
                  >
                    {levelLabel(w, key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">{w.criticalityLabel}</span>
              <div className="flex flex-wrap gap-2">
                {LEVEL4_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, assetCriticality: key }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      state.assetCriticality === key
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border text-muted hover:text-ink"
                    }`}
                  >
                    {levelLabel(w, key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">{w.regulatoryLabel}</span>
              <div className="flex flex-wrap gap-2">
                {LEVEL3_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, regulatoryPressure: key }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      state.regulatoryPressure === key
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border text-muted hover:text-ink"
                    }`}
                  >
                    {levelLabel(w, key)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{w.step4Title}</h3>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{w.kpisLabel}</span>
            <div className="flex gap-2">
              <input
                value={kpiDraft}
                onChange={(e) => setKpiDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKpi();
                  }
                }}
                placeholder={w.kpisPlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={addKpi}
                className="shrink-0 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:border-accent/60"
              >
                {w.kpisAdd}
              </button>
            </div>
          </label>
          {state.kpis.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.kpis.map((kpi) => (
                <span
                  key={kpi}
                  className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong"
                >
                  {kpi}
                  <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, kpis: s.kpis.filter((k) => k !== kpi) }))}
                    className="text-accent-strong hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{w.step5Title}</h3>
          <p className="text-sm text-muted">{w.reviewIntro}</p>
          <dl className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            {state.scope && (
              <div>
                <dt className="text-xs font-semibold text-muted">{w.scopeLabel}</dt>
                <dd className="text-ink">{state.scope}</dd>
              </div>
            )}
            {state.currentState && (
              <div>
                <dt className="text-xs font-semibold text-muted">{w.currentStateLabel}</dt>
                <dd className="text-ink">{state.currentState}</dd>
              </div>
            )}
            {state.targetState && (
              <div>
                <dt className="text-xs font-semibold text-muted">{w.targetStateLabel}</dt>
                <dd className="text-ink">{state.targetState}</dd>
              </div>
            )}
            {state.primaryObjective && (
              <div>
                <dt className="text-xs font-semibold text-muted">{w.primaryObjectiveLabel}</dt>
                <dd className="text-ink">{objectiveLabel(w, state.primaryObjective)}</dd>
              </div>
            )}
            {state.kpis.length > 0 && (
              <div>
                <dt className="text-xs font-semibold text-muted">{w.kpisLabel}</dt>
                <dd className="text-ink">{state.kpis.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel() : setStep((s) => s - 1))}
          disabled={submitting}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {step === 1 ? w.cancel : w.back}
        </button>
        {step < totalSteps ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 && !canLeaveStep1}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {w.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? w.completing : w.complete}
          </button>
        )}
      </div>
    </div>
  );
}
