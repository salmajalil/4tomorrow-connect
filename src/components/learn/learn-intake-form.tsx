"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { extractFileText } from "@/lib/extract-file-text";
import type { TrainingMode } from "@/lib/learn";

export interface LearnIntakeState {
  transformationId: string | null;
  topic: string;
  audience: string;
  mode: TrainingMode;
  sourceDocText: string;
  sourceDocName: string;
  organization: string;
  industry: string;
}

const MODE_OPTIONS: { id: TrainingMode; label: string; description: string }[] = [
  { id: "rapide", label: "Rapide", description: "Sujet en texte libre, génération directe avec exemples réels trouvés sur le web." },
  { id: "document", label: "Document joint", description: "Un support existant (procédure, brief) devient la base factuelle du contenu." },
  { id: "diagnostic", label: "Lié à un projet", description: "S'appuie sur un diagnostic Decide déjà fait — contenu directement pertinent, zéro ressaisie." },
];

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
  const [state, setState] = useState<LearnIntakeState>({
    transformationId: initialTransformationId,
    topic: "",
    audience: "",
    mode: initialTransformationId || existingProjects.length > 0 ? "diagnostic" : "rapide",
    sourceDocText: "",
    sourceDocName: "",
    organization: "",
    industry: "",
  });
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
      setUploadError(err instanceof Error ? err.message : "Extraction impossible.");
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
        if (canSubmit) onSubmit(state);
      }}
      className="flex flex-col gap-8"
    >
      <div>
        <Eyebrow>Learn</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Génère une formation</h1>
        <p className="mt-1 text-sm text-muted">
          Objectifs, points clés avec exemples réels, flashcards, quiz de validation et script vidéo — générés
          ensemble, prêts à servir de preuve Qualiopi.
        </p>
      </div>

      {existingProjects.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Projet</span>
          <select
            value={state.transformationId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setState((s) => ({ ...s, transformationId: id, mode: id ? "diagnostic" : "rapide" }));
            }}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
          >
            <option value="">Nouveau sujet (pas de projet existant)</option>
            {existingProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Sujet de la formation</span>
        <textarea
          value={state.topic}
          onChange={(e) => setState((s) => ({ ...s, topic: e.target.value }))}
          placeholder="Ex : Comprendre les niveaux de maturité TRL avant de choisir une techno hydrogène"
          rows={3}
          className="resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Public visé</span>
        <input
          value={state.audience}
          onChange={(e) => setState((s) => ({ ...s, audience: e.target.value }))}
          placeholder="Ex : équipe opérationnelle, novice sur le sujet"
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Mode de génération</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.id === "diagnostic" && existingProjects.length === 0}
              onClick={() => setState((s) => ({ ...s, mode: opt.id }))}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                state.mode === opt.id ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50"
              }`}
            >
              <span className="text-sm font-semibold text-ink">{opt.label}</span>
              <span className="text-xs text-muted">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {state.mode === "diagnostic" && existingProjects.length === 0 && (
        <p className="text-xs text-danger">Aucun projet existant — lance d&apos;abord un diagnostic Decide, ou choisis un autre mode.</p>
      )}

      {state.mode === "document" && (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Document source</span>
          <span className="text-xs text-muted">.txt, .md ou .docx — le PDF n&apos;est pas pris en charge.</span>
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
          {state.sourceDocName && !uploading && (
            <span className="text-xs text-success">✓ {state.sourceDocName} importé ({state.sourceDocText.length} caractères)</span>
          )}
        </div>
      )}

      {!state.transformationId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Organisation (optionnel)</span>
            <input
              value={state.organization}
              onChange={(e) => setState((s) => ({ ...s, organization: e.target.value }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Industrie (optionnel)</span>
            <input
              value={state.industry}
              onChange={(e) => setState((s) => ({ ...s, industry: e.target.value }))}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Génération..." : "Générer la formation"}
      </button>
    </form>
  );
}
