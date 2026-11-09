"use client";

import { Icon, type IconName } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { ComputedBadge } from "@/components/computed-badge";
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
  validateSkillInputs,
  rankSkillGaps,
  buildTrainingSuggestions,
  type Domain,
  type SkillAssessmentInput,
  type SkillGapResult,
  type TrainingSuggestionImpact,
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

// F01 — one card per role×domain cell, replacing the earlier flat table.
// The segmented bar shows both numbers at once on a single 0-4 scale:
// filled accent = demonstrated (achieved), filled danger/40 = the gap still
// to close up to the required level, empty = above what's required. Numbers
// themselves (gap, priorité) are never recomputed here — straight from
// computeSkillGaps()/rankSkillGaps() in src/lib/learn-skills-calc.ts.
function SkillGapCard({ result: r, skillsT }: { result: SkillGapResult; skillsT: Dictionary["learn"]["skills"] }) {
  const toConfirm = r.status === "à confirmer";
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        r.gap > 0 ? "border-danger/30 bg-danger/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{r.role}</p>
          <p className="text-xs text-muted">{DOMAIN_LABELS[r.domain]}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            toConfirm ? "bg-surface-2 text-muted" : "bg-success/15 text-success"
          }`}
        >
          {toConfirm ? skillsT.statusToConfirm : skillsT.statusConfirmed}
        </span>
      </div>

      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: SKILL_LEVEL_MAX }, (_, i) => {
          const level = i + 1;
          const filled = level <= r.demonstrated ? "bg-accent" : level <= r.required ? "bg-danger/40" : "bg-border";
          return <span key={i} className={`h-2 flex-1 rounded-full ${filled}`} />;
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {skillsT.demonstrated} {r.demonstrated}/{SKILL_LEVEL_MAX}
        </span>
        <span>
          {skillsT.required} {r.required}/{SKILL_LEVEL_MAX}
        </span>
      </div>

      {r.gap > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5 text-xs">
          <span className="font-semibold text-ink">
            {skillsT.gap} {r.gap}
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted">
            {skillsT.priority} <span className="font-semibold text-ink">{r.weighted}</span>
          </span>
          <ComputedBadge className="ml-auto" />
        </div>
      )}
    </div>
  );
}

// F01 — formation suggérée, au moins aussi visuelle que les cartes de
// diagnostic : intitulé en titre, impact visé en gros chiffre (écart du
// rôle le plus prioritaire du domaine), barre segmentée avant → visé sur la
// même échelle 0-4 que les cartes d'écart, puis l'ampleur sur le domaine
// (rôles concernés, niveaux cumulés, priorité). Tous les chiffres viennent
// de buildTrainingSuggestions() (learn-skills-calc.ts) — aucun n'est
// recalculé ni inventé ici ; l'intitulé vient du catalogue, jamais de l'IA.
function TrainingSuggestionCard({
  item,
  rank,
  skillsT,
  selected,
  onUseTopic,
}: {
  item: TrainingSuggestionImpact;
  rank: number;
  skillsT: Dictionary["learn"]["skills"];
  selected: boolean;
  onUseTopic: () => void;
}) {
  const top = item.topGap;
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition ${
        selected ? "border-accent bg-accent/10" : "border-accent/30 bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-mono text-xs font-semibold text-accent-strong">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-ink">{item.suggestion}</p>
          <p className="text-xs text-muted">{DOMAIN_LABELS[item.domain]}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl leading-none text-success tabular-nums">
            {skillsT.impactLevels.replace("{n}", String(item.levelsTargeted))}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted">{skillsT.impactTarget.replace("{role}", top.role)}</p>
          <ComputedBadge />
        </div>
        <div className="flex gap-0.5" aria-hidden>
          {Array.from({ length: SKILL_LEVEL_MAX }, (_, i) => {
            const level = i + 1;
            const filled =
              level <= top.demonstrated
                ? "bg-accent"
                : level <= top.required
                  ? "bg-success/70"
                  : "bg-border";
            return <span key={i} className={`h-2.5 flex-1 rounded-full ${filled}`} />;
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              {skillsT.legendToday}
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-2 w-2 rounded-full bg-success/70" />
              {skillsT.legendClosed}
            </span>
          </span>
          <span className="tabular-nums">
            {skillsT.impactBeforeAfter
              .replace("{from}", String(top.demonstrated))
              .replace("{to}", String(top.required))
              .replaceAll("{max}", String(SKILL_LEVEL_MAX))}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink">
          {skillsT.impactRoles.replace("{n}", String(item.rolesAffected))}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink">
          {skillsT.impactTotalLevels.replace("{n}", String(item.totalGapLevels))}
        </span>
        <span className="rounded-full bg-danger/10 px-2.5 py-1 text-danger">
          {skillsT.impactPriority.replace("{n}", String(item.totalWeighted))}
        </span>
      </div>

      <button
        type="button"
        onClick={onUseTopic}
        disabled={selected}
        className={`self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          selected ? "bg-accent text-accent-ink" : "border border-accent text-accent-strong hover:bg-accent/10"
        }`}
      >
        {selected ? `✓ ${skillsT.topicSelected}` : skillsT.useTopic}
      </button>
    </div>
  );
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

  // F01 — chaque ligne passe par validateSkillInputs (la même règle que le
  // serveur, src/app/api/learn/generate/route.ts) : une ligne invalide (rôle
  // vide, niveau hors bornes) est signalée sur la ligne elle-même et bloque
  // la génération, au lieu d'être ignorée en silence.
  const toSkillInput = (r: SkillRow): SkillAssessmentInput => ({
    role: r.role,
    domain: r.domain,
    required: r.required,
    demonstrated: r.demonstrated,
    criticality: r.criticality,
    selfAssessed: r.selfAssessed,
  });
  const skillRowErrors = new Map<string, string[]>();
  for (const r of skillRows) {
    const errors = validateSkillInputs([toSkillInput(r)]);
    if (errors.length > 0) skillRowErrors.set(r.id, errors);
  }
  const validSkillInputs: SkillAssessmentInput[] = skillRows.filter((r) => !skillRowErrors.has(r.id)).map(toSkillInput);
  const skillResults = computeSkillGaps(validSkillInputs);
  const rankedSkillResults = rankSkillGaps(skillResults);
  const trainingSuggestions = buildTrainingSuggestions(skillResults, catalog);

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
    skillRowErrors.size === 0 &&
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
                    aria-invalid={row.role.trim() === "" || undefined}
                    className={`rounded-lg border ${row.role.trim() === "" ? "border-danger/60" : "border-border"} bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none`}
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
              {skillRowErrors.has(row.id) && (
                <ul role="alert" className="flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {/* Rôle vide : message traduit. Les autres erreurs (niveaux hors
                      bornes, impossibles via les curseurs) gardent le texte de
                      validateSkillInputs. */}
                  {row.role.trim() === ""
                    ? <li>{skillsT.roleMissing}</li>
                    : (skillRowErrors.get(row.id) ?? []).map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>
          ))}

          {skillRowErrors.size > 0 && (
            <p role="status" className="text-sm font-medium text-danger">
              {skillsT.rowsInvalid.replace("{n}", String(skillRowErrors.size))}
            </p>
          )}

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
            <p className="font-display text-base text-ink">
              {rankedSkillResults[0].gap > 0
                ? skillsT.headline
                    .replace("{n}", String(rankedSkillResults.filter((r) => r.gap > 0).length))
                    .replace("{role}", rankedSkillResults[0].role)
                    .replace("{domain}", DOMAIN_LABELS[rankedSkillResults[0].domain])
                : skillsT.noGaps}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rankedSkillResults.map((r, i) => (
                <SkillGapCard key={`${r.role}-${r.domain}-${i}`} result={r} skillsT={skillsT} />
              ))}
            </div>
          </div>
        )}

        {trainingSuggestions.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{skillsT.suggestionsTitle}</span>
            <p className="text-xs text-muted">{skillsT.suggestionsHint}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {trainingSuggestions.map((item, i) => (
                <TrainingSuggestionCard
                  key={item.domain}
                  item={item}
                  rank={i + 1}
                  skillsT={skillsT}
                  selected={state.topic.trim() === item.suggestion.trim()}
                  onUseTopic={() => setState((s) => ({ ...s, topic: item.suggestion }))}
                />
              ))}
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

        {rankedSkillResults.length > 0 && (
          <details className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-accent-strong">{skillsT.howCalculatedTitle}</summary>
            <p className="mt-2 text-muted">{skillsT.howCalculatedBody}</p>
          </details>
        )}
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
