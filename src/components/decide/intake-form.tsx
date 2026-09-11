"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";

export interface IntakeState {
  organization: string;
  industry: string;
  challenges: string;
  objectives: string;
  constraints: string;
  regulations: string;
  uploadedDocText: string;
  uploadedDocName: string;
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
        if (canSubmit) onSubmit(state);
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
