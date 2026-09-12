"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";

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

const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
};

const SCOPE_LABELS: Record<ProjectScope, string> = {
  local: "Locale",
  national: "Nationale",
  global: "Globale / internationale",
};

const URGENCY_LABELS: Record<Urgency, string> = {
  immediate: "Immédiat (0-6 mois)",
  planned: "Planifié (6-18 mois)",
  long_term: "Long terme (18 mois et plus)",
};

const ORGANIZATION_SIZE_LABELS: Record<OrganizationSize, string> = {
  small: "Petite (< 50 personnes)",
  medium: "Moyenne (50-500)",
  large: "Grande (500-5000)",
  enterprise: "Très grande (5000+)",
};

// Folded into the free-text "constraints" sent to the diagnostic/scenario
// prompts (both already read transformation.constraints) — no schema or
// server-side change needed to get this structured context to the AI.
function formatStructuredContext(state: IntakeState): string {
  return `Contexte structuré (renseigné via curseurs/menus) :
- Flexibilité budgétaire : ${state.budgetFlexibility}% (0 = serré, 100 = flexible)
- Priorité CO2 / durabilité : ${state.co2Priority}%
- Tolérance au risque : ${RISK_TOLERANCE_LABELS[state.riskTolerance]}
- Portée du projet : ${SCOPE_LABELS[state.scope]}
- Urgence : ${URGENCY_LABELS[state.urgency]}
- Horizon envisagé : ${state.horizonYears} an${state.horizonYears > 1 ? "s" : ""}
- Taille de l'organisation : ${ORGANIZATION_SIZE_LABELS[state.organizationSize]}`;
}

const CHALLENGES_PLACEHOLDER = `Ex : On veut digitaliser notre suivi de production, aujourd'hui géré sur Excel par 3 personnes à temps plein. Erreurs fréquentes de saisie, pas de visibilité temps réel pour la direction. Contrainte : l'ERP actuel a 12 ans et personne en interne ne sait le modifier.`;

async function extractFileText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return file.text();
  }
  if (lower.endsWith(".docx")) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/decide/extract-doc", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Extraction impossible.");
    return data.text as string;
  }
  throw new Error("Format non supporté — utilise .txt, .md ou .docx (le PDF n'est pas pris en charge).");
}

export function IntakeForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (state: IntakeState) => void;
  submitting: boolean;
}) {
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

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const text = await extractFileText(file);
      setState((s) => ({ ...s, uploadedDocText: text, uploadedDocName: file.name }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Extraction impossible.");
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
        const structured = formatStructuredContext(state);
        onSubmit({
          ...state,
          constraints: state.constraints.trim() ? `${structured}\n\n${state.constraints}` : structured,
        });
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <Eyebrow>Intake</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Décris ta transformation</h1>
        <p className="mt-1 text-sm text-muted">
          Réponses libres — plus c&apos;est précis, plus le diagnostic sera pointu. Rien n&apos;est
          obligatoire sauf les défis ou les objectifs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Organisation</span>
          <input
            value={state.organization}
            onChange={(e) => setState((s) => ({ ...s, organization: e.target.value }))}
            placeholder="Nom de ton organisation"
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Industrie</span>
          <input
            value={state.industry}
            onChange={(e) => setState((s) => ({ ...s, industry: e.target.value }))}
            placeholder="Ex : Manufacturing, SaaS, Énergie..."
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Défis</span>
        <textarea
          value={state.challenges}
          onChange={(e) => setState((s) => ({ ...s, challenges: e.target.value }))}
          placeholder={CHALLENGES_PLACEHOLDER}
          rows={6}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Objectifs</span>
        <textarea
          value={state.objectives}
          onChange={(e) => setState((s) => ({ ...s, objectives: e.target.value }))}
          placeholder="Ce que tu veux atteindre, avec un horizon si tu en as un."
          rows={4}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Contraintes</span>
        <textarea
          value={state.constraints}
          onChange={(e) => setState((s) => ({ ...s, constraints: e.target.value }))}
          placeholder="Budget, délais, ressources, dépendances techniques..."
          rows={4}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Régulations externes applicables (si connues)</span>
        <textarea
          value={state.regulations}
          onChange={(e) => setState((s) => ({ ...s, regulations: e.target.value }))}
          placeholder="Normes sectorielles, certifications déjà connues du client..."
          rows={3}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Document de référence (optionnel)</span>
        <span className="text-xs text-muted">
          .txt, .md ou .docx — cahier des charges, spécifications... Le PDF n&apos;est pas pris en
          charge (extraction non fiable).
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mt-1 text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
        />
        {uploading && <span className="text-xs text-muted">Extraction en cours...</span>}
        {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
        {state.uploadedDocName && !uploading && (
          <div className="flex items-center gap-2 text-xs text-success">
            <span>
              ✓ {state.uploadedDocName} importé ({state.uploadedDocText.length} caractères)
            </span>
            <button
              type="button"
              onClick={() => {
                setState((s) => ({ ...s, uploadedDocText: "", uploadedDocName: "" }));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted underline underline-offset-2 hover:text-danger"
            >
              Retirer
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Contexte du projet (optionnel, mais aide à cadrer le diagnostic)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between font-medium text-ink">
              <span>Flexibilité budgétaire</span>
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
              <span>Serré</span>
              <span>Flexible</span>
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between font-medium text-ink">
              <span>Priorité CO2 / durabilité</span>
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
          <span className="font-medium text-ink">Tolérance au risque</span>
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
            <span className="font-medium text-ink">Portée du projet</span>
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
            <span className="font-medium text-ink">Urgence</span>
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
              <span>Horizon envisagé</span>
              <span className="text-accent">
                {state.horizonYears} an{state.horizonYears > 1 ? "s" : ""}
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
            <span className="font-medium text-ink">Taille de l&apos;organisation</span>
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
        {submitting ? "Diagnostic en cours..." : "Lancer le diagnostic"}
      </button>
    </form>
  );
}
