"use client";

import { useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { extractFileText } from "@/lib/extract-file-text";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
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

function modeOptions(intake: Dictionary["learn"]["intake"]): {
  id: TrainingMode;
  icon: string;
  label: string;
  description: string;
}[] {
  return [
    { id: "rapide", icon: "⚡", label: intake.modeRapide, description: intake.modeRapideDesc },
    { id: "document", icon: "📄", label: intake.modeDocument, description: intake.modeDocumentDesc },
    { id: "diagnostic", icon: "🎯", label: intake.modeDiagnostic, description: intake.modeDiagnosticDesc },
    { id: "workshop", icon: "🧭", label: intake.modeWorkshop, description: intake.modeWorkshopDesc },
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
        if (canSubmit) onSubmit(state);
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
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-xl">
                  {opt.icon}
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
