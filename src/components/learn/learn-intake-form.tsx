"use client";

import { Icon, type IconName } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { extractFileText } from "@/lib/extract-file-text";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { TrainingMode } from "@/lib/learn";
import { DOMAIN_LABELS } from "@/lib/decide";
import {
  DOMAINS,
  SKILL_LEVEL_MIN,
  SKILL_LEVEL_MAX,
  CRITICALITY_MIN,
  CRITICALITY_MAX,
  DEFAULT_TRAINING_SUGGESTIONS,
  computeSkillGaps,
  rankSkillGaps,
  topGapPerDomain,
  suggestTrainingForGap,
  type Domain,
  type SkillAssessmentInput,
} from "@/lib/learn-skills-calc";

export interface LearnIntakeState {
  transformationId: string | null;
  topic: string;
  audience: string;
  mode: TrainingMode;
  sourceDocText: string;
  sourceDocName: string;
  organization: string;
  industry: string;
  // F01 — the structured skills matrix (see src/lib/learn-skills-calc.ts).
  // Sent as-is; gaps/priority/status are computed server-side, never by
  // the AI. Empty by default — nothing required to generate a training.
  skillAssessments: SkillAssessmentInput[];
}

let skillRowSeq = 0;
function nextSkillRowId() {
  skillRowSeq += 1;
  return `skill-row-${skillRowSeq}`;
}

interface SkillRow extends SkillAssessmentInput {
  id: string;
}

function defaultSkillRow(): SkillRow {
  return { id: nextSkillRowId(), role: "", domain: "manufacturing", required: 3, demonstrated: 1, criticality: 3, selfAssessed: false };
}

function modeOptions(intake: Dictionary["learn"]["intake"]): {
  id: TrainingMode;
  icon: IconName;
  label: string;
  description: string;
}[] {
  return [
    { id: "rapide", icon: "bolt", label: intake.modeRapide, description: intake.modeRapideDesc },
    { id: "document", icon: "document", label: intake.modeDocument, description: intake.modeDocumentDesc },
    { id: "diagnostic", icon: "target", label: intake.modeDiagnostic, description: intake.modeDiagnosticDesc },
    { id: "workshop", icon: "route", label: intake.modeWorkshop, description: intake.modeWorkshopDesc },
  ];
}

export function LearnIntakeForm({
  onSubmit,
  submitting,
  existingProjects,
  initialTransformationId = null,
}: {
  onSubmit: (state: LearnIntakeState) => void;
  submitting: boolean;
  existingProjects: { id: string; title: string }[];
  initialTransformationId?: string | null;
}) {
  const { t } = useLanguage();
  const intake = t.learn.intake;
  const skillsT = t.learn.skills;
  const MODE_OPTIONS = modeOptions(intake);
  const [state, setState] = useState<LearnIntakeState>({
    transformationId: initialTransformationId,
    topic: "",
    audience: "",
    mode: initialTransformationId || existingProjects.length > 0 ? "diagnostic" : "rapide",
    sourceDocText: "",
    sourceDocName: "",
    organization: "",
    industry: "",
    skillAssessments: [],
  });
  const [skillRows, setSkillRows] = useState<SkillRow[]>([]);
  const [catalog, setCatalog] = useState<Partial<Record<Domain, string>>>({});
  const [catalogDraft, setCatalogDraft] = useState<Partial<Record<Domain, string>>>({});
  const [catalogSaved, setCatalogSaved] = useState<Domain | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/learn/training-suggestions")
      .then((res) => (res.ok ? res.json() : { suggestions: [] }))
      .then((data: { suggestions?: { domain: Domain; suggestion: string }[] }) => {
        if (cancelled) return;
        const loaded: Partial<Record<Domain, string>> = {};
        for (const row of data.suggestions ?? []) loaded[row.domain] = row.suggestion;
        setCatalog(loaded);
        setCatalogDraft(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const validSkillInputs: SkillAssessmentInput[] = skillRows
    .filter((r) => r.role.trim().length > 0)
    .map((r) => ({
      role: r.role,
      domain: r.domain,
      required: r.required,
      demonstrated: r.demonstrated,
      criticality: r.criticality,
      selfAssessed: r.selfAssessed,
    }));
  const skillResults = computeSkillGaps(validSkillInputs);
  const rankedSkillResults = rankSkillGaps(skillResults);
  const topGaps = topGapPerDomain(skillResults);

  function updateSkillRow(id: string, patch: Partial<SkillAssessmentInput>) {
    setSkillRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveCatalogEntry(domain: Domain) {
    const suggestion = (catalogDraft[domain] ?? "").trim();
    if (!suggestion) return;
    try {
      const res = await fetch("/api/learn/training-suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, suggestion }),
      });
      if (res.ok) {
        setCatalog((c) => ({ ...c, [domain]: suggestion }));
        setCatalogSaved(domain);
        setTimeout(() => setCatalogSaved((d) => (d === domain ? null : d)), 1500);
      }
    } catch {
      // Best-effort — the default catalog (DEFAULT_TRAINING_SUGGESTIONS) still applies either way.
    }
  }
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const text = await extractFileText(file);
      setState((s) => ({ ...s, sourceDocText: text, sourceDocName: file.name }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : intake.uploadError);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit =
    state.topic.trim().length > 0 &&
    !submitting &&
    (state.mode !== "diagnostic" || !!state.transformationId) &&
    (state.mode !== "document" || (!!state.sourceDocText && !uploading));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ ...state, skillAssessments: validSkillInputs });
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <Eyebrow>Learn</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">{intake.title}</h1>
        <p className="mt-1 text-sm text-muted">{intake.subtitle}</p>
      </div>

      {existingProjects.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.project}</span>
          <select
            value={state.transformationId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setState((s) => ({ ...s, transformationId: id, mode: id ? "diagnostic" : "rapide" }));
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
          >
            <option value="">{intake.newTopicNoProject}</option>
            {existingProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{state.mode === "workshop" ? intake.topicWorkshop : intake.topic}</span>
        <textarea
          value={state.topic}
          onChange={(e) => setState((s) => ({ ...s, topic: e.target.value }))}
          placeholder={state.mode === "workshop" ? intake.topicPlaceholderWorkshop : intake.topicPlaceholder}
          rows={3}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{state.mode === "workshop" ? intake.audienceWorkshop : intake.audience}</span>
        <input
          value={state.audience}
          onChange={(e) => setState((s) => ({ ...s, audience: e.target.value }))}
          placeholder={state.mode === "workshop" ? intake.audiencePlaceholderWorkshop : intake.audiencePlaceholder}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">{intake.generationMode}</span>
        <div className="flex flex-col gap-2.5">
          {MODE_OPTIONS.map((opt) => {
            const selected = state.mode === opt.id;
            const disabled = opt.id === "diagnostic" && existingProjects.length === 0;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => setState((s) => ({ ...s, mode: opt.id }))}
                className={`flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">
                  <Icon name={opt.icon} className="h-5 w-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{opt.label}</span>
                  <span className="text-xs text-muted">{opt.description}</span>
                </span>
                {selected && (
                  <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {state.mode === "diagnostic" && existingProjects.length === 0 && (
        <p className="text-xs text-danger">{intake.noProjectWarning}</p>
      )}

      {state.mode === "document" && (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.sourceDoc}</span>
          <span className="text-xs text-muted">{intake.sourceDocHint}</span>
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
          {state.sourceDocName && !uploading && (
            <span className="text-xs text-success">
              ✓ {state.sourceDocName} {intake.imported} ({state.sourceDocText.length} {t.common.characters})
            </span>
          )}
        </div>
      )}

      {!state.transformationId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{intake.organizationOptional}</span>
            <input
              value={state.organization}
              onChange={(e) => setState((s) => ({ ...s, organization: e.target.value }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{intake.industryOptional}</span>
            <input
              value={state.industry}
              onChange={(e) => setState((s) => ({ ...s, industry: e.target.value }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{skillsT.title}</span>
          <p className="mt-1 text-xs text-muted">{skillsT.hint}</p>
        </div>

        <div className="flex flex-col gap-3">
          {skillRows.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="flex items-center gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  <span className="font-medium text-muted">{skillsT.role}</span>
                  <input
                    value={row.role}
                    onChange={(e) => updateSkillRow(row.id, { role: e.target.value })}
                    placeholder={skillsT.rolePlaceholder}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted">{skillsT.domain}</span>
                  <select
                    value={row.domain}
                    onChange={(e) => updateSkillRow(row.id, { domain: e.target.value as Domain })}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {DOMAIN_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setSkillRows((rows) => rows.filter((r) => r.id !== row.id))}
                  className="mt-4 text-xs text-muted underline underline-offset-2 hover:text-danger"
                >
                  {skillsT.removeRow}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="flex items-center justify-between font-medium text-muted">
                    <span>{skillsT.required}</span>
                    <span className="text-accent">{row.required}</span>
                  </span>
                  <input
                    type="range"
                    min={SKILL_LEVEL_MIN}
                    max={SKILL_LEVEL_MAX}
                    value={row.required}
                    onChange={(e) => updateSkillRow(row.id, { required: Number(e.target.value) })}
                    className="accent-[var(--accent)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="flex items-center justify-between font-medium text-muted">
                    <span>{skillsT.demonstrated}</span>
                    <span className="text-accent">{row.demonstrated}</span>
                  </span>
                  <input
                    type="range"
                    min={SKILL_LEVEL_MIN}
                    max={SKILL_LEVEL_MAX}
                    value={row.demonstrated}
                    onChange={(e) => updateSkillRow(row.id, { demonstrated: Number(e.target.value) })}
                    className="accent-[var(--accent)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="flex items-center justify-between font-medium text-muted">
                    <span>{skillsT.criticality}</span>
                    <span className="text-accent">{row.criticality}</span>
                  </span>
                  <input
                    type="range"
                    min={CRITICALITY_MIN}
                    max={CRITICALITY_MAX}
                    value={row.criticality}
                    onChange={(e) => updateSkillRow(row.id, { criticality: Number(e.target.value) })}
                    className="accent-[var(--accent)]"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={row.selfAssessed}
                  onChange={(e) => updateSkillRow(row.id, { selfAssessed: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                {skillsT.selfAssessed}
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setSkillRows((rows) => [...rows, defaultSkillRow()])}
            className="self-start rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink transition hover:border-accent/50"
          >
            + {skillsT.addRow}
          </button>
        </div>

        {rankedSkillResults.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{skillsT.resultsTitle}</span>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="px-3 py-2 font-medium">{skillsT.role}</th>
                    <th className="px-3 py-2 font-medium">{skillsT.domain}</th>
                    <th className="px-3 py-2 font-medium">{skillsT.gap}</th>
                    <th className="px-3 py-2 font-medium">{skillsT.priority}</th>
                    <th className="px-3 py-2 font-medium">{skillsT.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedSkillResults.map((r, i) => (
                    <tr key={`${r.role}-${r.domain}-${i}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-ink">{r.role}</td>
                      <td className="px-3 py-2 text-muted">{DOMAIN_LABELS[r.domain]}</td>
                      <td className="px-3 py-2 text-ink">{r.gap}</td>
                      <td className="px-3 py-2 text-ink">{r.weighted}</td>
                      <td className="px-3 py-2">
                        <span className={r.status === "à confirmer" ? "text-muted" : "text-success"}>
                          {r.status === "à confirmer" ? skillsT.statusToConfirm : skillsT.statusConfirmed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {topGaps.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{skillsT.topGapsTitle}</span>
            <div className="flex flex-col gap-2">
              {topGaps.map((gap) => {
                const suggestion = suggestTrainingForGap(gap.domain, catalog) ?? DEFAULT_TRAINING_SUGGESTIONS[gap.domain];
                return (
                  <div
                    key={gap.domain}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs"
                  >
                    <span>
                      <span className="font-medium text-ink">{DOMAIN_LABELS[gap.domain]}</span>{" "}
                      <span className="text-muted">— {suggestion}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setState((s) => ({ ...s, topic: suggestion }))}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 font-medium text-ink transition hover:border-accent/50"
                    >
                      {skillsT.useTopic}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer font-semibold uppercase tracking-wide text-muted">{skillsT.catalogTitle}</summary>
          <p className="mt-2 text-muted">{skillsT.catalogHint}</p>
          <div className="mt-2 flex flex-col gap-2">
            {DOMAINS.map((d) => (
              <div key={d} className="flex flex-wrap items-center gap-2">
                <span className="w-40 shrink-0 font-medium text-ink">{DOMAIN_LABELS[d]}</span>
                <input
                  value={catalogDraft[d] ?? DEFAULT_TRAINING_SUGGESTIONS[d]}
                  onChange={(e) => setCatalogDraft((c) => ({ ...c, [d]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => saveCatalogEntry(d)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 font-medium text-ink transition hover:border-accent/50"
                >
                  {catalogSaved === d ? `✓ ${skillsT.catalogSaved}` : skillsT.catalogSave}
                </button>
              </div>
            ))}
          </div>
        </details>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? intake.submitting : state.mode === "workshop" ? intake.submitWorkshop : intake.submit}
      </button>
    </form>
  );
}
