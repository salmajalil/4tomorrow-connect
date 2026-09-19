"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractFileText } from "@/lib/extract-file-text";
import { DOMAIN_LABELS, DOMAIN_ICONS, type Domain } from "@/lib/decide";
import { useLanguage } from "@/components/language-provider";

function StatusBadge({ done, doneLabel, todoLabel }: { done: boolean; doneLabel: string; todoLabel: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        done ? "bg-success/15 text-success" : "bg-surface-2 text-muted"
      }`}
    >
      {done ? doneLabel : todoLabel}
    </span>
  );
}

export function InputsTab({
  transformationId,
  organizationId,
  initialConstraints,
  initialIndustry,
  domains,
  documentCount,
  onDocumentAdded,
}: {
  transformationId: string;
  organizationId: string;
  initialConstraints: string;
  initialIndustry: string;
  domains: Domain[];
  documentCount: number;
  onDocumentAdded: (text: string) => void;
}) {
  const { t } = useLanguage();
  const inputs = t.deliver.inputs;
  const [constraints, setConstraints] = useState(initialConstraints);
  const [editingConstraints, setEditingConstraints] = useState(false);
  const [savingConstraints, setSavingConstraints] = useState(false);

  const [industry, setIndustry] = useState(initialIndustry);
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [savingIndustry, setSavingIndustry] = useState(false);

  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveConstraints() {
    setSavingConstraints(true);
    await createClient().from("transformations").update({ constraints }).eq("id", transformationId);
    setSavingConstraints(false);
    setEditingConstraints(false);
  }

  async function saveIndustry() {
    setSavingIndustry(true);
    await createClient().from("organizations").update({ industry }).eq("id", organizationId);
    setSavingIndustry(false);
    setEditingIndustry(false);
  }

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const text = await extractFileText(file);
      onDocumentAdded(text);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.decide.intake.uploadError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-ink">{inputs.diagnosticAssessment}</h3>
          <StatusBadge done={constraints.trim().length > 0} doneLabel={inputs.done} todoLabel={inputs.todo} />
        </div>
        <p className="mt-1 text-xs text-muted">{inputs.diagnosticAssessmentDesc}</p>
        {editingConstraints ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={4}
              placeholder={inputs.constraintsPlaceholder}
              className="resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={saveConstraints}
              disabled={savingConstraints}
              className="self-start rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              {savingConstraints ? inputs.saving : inputs.save}
            </button>
          </div>
        ) : (
          <>
            {constraints.trim() && <p className="mt-2 text-sm text-ink">{constraints}</p>}
            <button
              type="button"
              onClick={() => setEditingConstraints(true)}
              className="mt-3 text-xs font-semibold text-accent underline underline-offset-2"
            >
              {constraints.trim() ? inputs.edit : inputs.answer}
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-ink">{inputs.projectDocuments}</h3>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold text-muted">
            {documentCount} {documentCount > 1 ? inputs.documents : inputs.document}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">{inputs.projectDocumentsDesc}</p>
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
          className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/50"
        >
          {t.common.chooseFile}
        </button>
        {uploading && <p className="mt-1 text-xs text-muted">{inputs.extracting}</p>}
        {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-ink">{inputs.industryContext}</h3>
          <StatusBadge done={industry.trim().length > 0} doneLabel={inputs.specified} todoLabel={inputs.toRefine} />
        </div>
        {domains.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {domains.map((d) => (
              <span
                key={d}
                className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent-strong"
              >
                <span aria-hidden>{DOMAIN_ICONS[d]}</span> {DOMAIN_LABELS[d]}
              </span>
            ))}
          </div>
        )}
        {editingIndustry ? (
          <div className="mt-3 flex gap-2">
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={inputs.industryPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={saveIndustry}
              disabled={savingIndustry}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              {savingIndustry ? "..." : "OK"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingIndustry(true)}
            className="mt-3 text-xs font-semibold text-accent underline underline-offset-2"
          >
            {industry.trim() ? `${industry} — ${inputs.editSector}` : inputs.specifySector}
          </button>
        )}
      </div>
    </div>
  );
}
