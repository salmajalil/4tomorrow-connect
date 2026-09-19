"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { extractFileText } from "@/lib/extract-file-text";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type RiskTolerance = "low" | "medium" | "high";
export type ProjectScope = "local" | "national" | "global";
export type Urgency = "immediate" | "planned" | "long_term";
export type OrganizationSize = "small" | "medium" | "large" | "enterprise";

export interface IntakeState {
  organization: string;
  industry: string;
  challenges: string;
  objectives: string;
  constraints: string;
  regulations: string;
  uploadedDocText: string;
  uploadedDocName: string;
  budgetFlexibility: number;
  co2Priority: number;
  riskTolerance: RiskTolerance;
  scope: ProjectScope;
  urgency: Urgency;
  horizonYears: number;
  organizationSize: OrganizationSize;
}

// Folded into the free-text "constraints" sent to the diagnostic/scenario
// prompts (both already read transformation.constraints) — no schema or
// server-side change needed to get this structured context to the AI.
function formatStructuredContext(state: IntakeState, t: Dictionary["decide"]["intake"]): string {
  const riskLabels: Record<RiskTolerance, string> = { low: t.riskLow, medium: t.riskMedium, high: t.riskHigh };
  const scopeLabels: Record<ProjectScope, string> = { local: t.scopeLocal, national: t.scopeNational, global: t.scopeGlobal };
  const urgencyLabels: Record<Urgency, string> = {
    immediate: t.urgencyImmediate,
    planned: t.urgencyPlanned,
    long_term: t.urgencyLongTerm,
  };
  const sizeLabels: Record<OrganizationSize, string> = {
    small: t.sizeSmall,
    medium: t.sizeMedium,
    large: t.sizeLarge,
    enterprise: t.sizeEnterprise,
  };

  return `${t.projectContext} :
- ${t.budgetFlexibility} : ${state.budgetFlexibility}% (0 = ${t.tight}, 100 = ${t.flexible})
- ${t.co2Priority} : ${state.co2Priority}%
- ${t.riskTolerance} : ${riskLabels[state.riskTolerance]}
- ${t.scope} : ${scopeLabels[state.scope]}
- ${t.urgency} : ${urgencyLabels[state.urgency]}
- ${t.horizon} : ${state.horizonYears} ${state.horizonYears > 1 ? t.years : t.year}
- ${t.organizationSize} : ${sizeLabels[state.organizationSize]}`;
}

export function IntakeForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (state: IntakeState) => void;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const intake = t.decide.intake;

  const [state, setState] = useState<IntakeState>({
    organization: "",
    industry: "",
    challenges: "",
    objectives: "",
    constraints: "",
    regulations: "",
    uploadedDocText: "",
    uploadedDocName: "",
    budgetFlexibility: 50,
    co2Priority: 50,
    riskTolerance: "medium",
    scope: "national",
    urgency: "planned",
    horizonYears: 3,
    organizationSize: "medium",
  });
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
    low: intake.riskLow,
    medium: intake.riskMedium,
    high: intake.riskHigh,
  };
  const SCOPE_LABELS: Record<ProjectScope, string> = {
    local: intake.scopeLocal,
    national: intake.scopeNational,
    global: intake.scopeGlobal,
  };
  const URGENCY_LABELS: Record<Urgency, string> = {
    immediate: intake.urgencyImmediate,
    planned: intake.urgencyPlanned,
    long_term: intake.urgencyLongTerm,
  };
  const ORGANIZATION_SIZE_LABELS: Record<OrganizationSize, string> = {
    small: intake.sizeSmall,
    medium: intake.sizeMedium,
    large: intake.sizeLarge,
    enterprise: intake.sizeEnterprise,
  };

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const text = await extractFileText(file);
      setState((s) => ({ ...s, uploadedDocText: text, uploadedDocName: file.name }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : intake.uploadError);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = (state.challenges.trim() || state.objectives.trim() || state.uploadedDocText.trim()) && !submitting;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const structured = formatStructuredContext(state, intake);
        onSubmit({
          ...state,
          constraints: state.constraints.trim() ? `${structured}\n\n${state.constraints}` : structured,
        });
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <Eyebrow>{intake.eyebrow}</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">{intake.title}</h1>
        <p className="mt-1 text-sm text-muted">{intake.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.organization}</span>
          <input
            value={state.organization}
            onChange={(e) => setState((s) => ({ ...s, organization: e.target.value }))}
            placeholder={intake.organizationPlaceholder}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.industry}</span>
          <input
            value={state.industry}
            onChange={(e) => setState((s) => ({ ...s, industry: e.target.value }))}
            placeholder={intake.industryPlaceholder}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.challenges}</span>
        <textarea
          value={state.challenges}
          onChange={(e) => setState((s) => ({ ...s, challenges: e.target.value }))}
          placeholder={intake.challengesPlaceholder}
          rows={6}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.objectives}</span>
        <textarea
          value={state.objectives}
          onChange={(e) => setState((s) => ({ ...s, objectives: e.target.value }))}
          placeholder={intake.objectivesPlaceholder}
          rows={4}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.constraints}</span>
        <textarea
          value={state.constraints}
          onChange={(e) => setState((s) => ({ ...s, constraints: e.target.value }))}
          placeholder={intake.constraintsPlaceholder}
          rows={4}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.regulations}</span>
        <textarea
          value={state.regulations}
          onChange={(e) => setState((s) => ({ ...s, regulations: e.target.value }))}
          placeholder={intake.regulationsPlaceholder}
          rows={3}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.referenceDoc}</span>
        <span className="text-xs text-muted">{intake.referenceDocHint}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-1 self-start rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          {t.common.chooseFile}
        </button>
        {uploading && <span className="text-xs text-muted">{intake.extracting}</span>}
        {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
        {state.uploadedDocName && !uploading && (
          <div className="flex items-center gap-2 text-xs text-success">
            <span>
              ✓ {state.uploadedDocName} {intake.imported} ({state.uploadedDocText.length}{" "}
              {t.common.characters})
            </span>
            <button
              type="button"
              onClick={() => {
                setState((s) => ({ ...s, uploadedDocText: "", uploadedDocName: "" }));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted underline underline-offset-2 hover:text-danger"
            >
              {t.common.remove}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{intake.projectContext}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between font-medium text-ink">
              <span>{intake.budgetFlexibility}</span>
              <span className="text-accent">{state.budgetFlexibility}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={state.budgetFlexibility}
              onChange={(e) => setState((s) => ({ ...s, budgetFlexibility: Number(e.target.value) }))}
              className="accent-[var(--accent)]"
            />
            <span className="flex justify-between text-[10px] text-muted">
              <span>{intake.tight}</span>
              <span>{intake.flexible}</span>
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between font-medium text-ink">
              <span>{intake.co2Priority}</span>
              <span className="text-accent">{state.co2Priority}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={state.co2Priority}
              onChange={(e) => setState((s) => ({ ...s, co2Priority: Number(e.target.value) }))}
              className="accent-[var(--accent)]"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.riskTolerance}</span>
          <div className="flex gap-2">
            {(Object.keys(RISK_TOLERANCE_LABELS) as RiskTolerance[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setState((s) => ({ ...s, riskTolerance: level }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  state.riskTolerance === level
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : "border-border text-muted hover:text-ink"
                }`}
              >
                {RISK_TOLERANCE_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{intake.scope}</span>
            <select
              value={state.scope}
              onChange={(e) => setState((s) => ({ ...s, scope: e.target.value as ProjectScope }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(SCOPE_LABELS) as ProjectScope[]).map((v) => (
                <option key={v} value={v}>
                  {SCOPE_LABELS[v]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{intake.urgency}</span>
            <select
              value={state.urgency}
              onChange={(e) => setState((s) => ({ ...s, urgency: e.target.value as Urgency }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(URGENCY_LABELS) as Urgency[]).map((v) => (
                <option key={v} value={v}>
                  {URGENCY_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between font-medium text-ink">
              <span>{intake.horizon}</span>
              <span className="text-accent">
                {state.horizonYears} {state.horizonYears > 1 ? intake.years : intake.year}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={state.horizonYears}
              onChange={(e) => setState((s) => ({ ...s, horizonYears: Number(e.target.value) }))}
              className="accent-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{intake.organizationSize}</span>
            <select
              value={state.organizationSize}
              onChange={(e) => setState((s) => ({ ...s, organizationSize: e.target.value as OrganizationSize }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(ORGANIZATION_SIZE_LABELS) as OrganizationSize[]).map((v) => (
                <option key={v} value={v}>
                  {ORGANIZATION_SIZE_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? intake.submitting : intake.submit}
      </button>
    </form>
  );
}
