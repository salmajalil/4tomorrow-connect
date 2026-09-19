"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractFileText } from "@/lib/extract-file-text";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";

export function UploadDocumentStart({ onCancel }: { onCancel: () => void }) {
  const { t } = useLanguage();
  const empty = t.deliver.empty;
  const intake = t.decide.intake;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [organization, setOrganization] = useState("");
  const [industry, setIndustry] = useState("");
  const [docText, setDocText] = useState("");
  const [docName, setDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const text = await extractFileText(file);
      setDocText(text);
      setDocName(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : intake.uploadError);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!docText.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/document-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization, industry, sourceDocText: docText, sourceDocName: docName }),
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

  return (
    <div className="mt-6 flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-5 text-left">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.organization}</span>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder={intake.organizationPlaceholder}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{intake.industry}</span>
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder={intake.industryPlaceholder}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
      </div>

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
          className="mt-1 self-start rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          {t.common.chooseFile}
        </button>
        {uploading && <span className="text-xs text-muted">{intake.extracting}</span>}
        {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
        {docName && !uploading && (
          <div className="flex items-center gap-2 text-xs text-success">
            <span>
              ✓ {docName} {intake.imported} ({docText.length} {t.common.characters})
            </span>
            <button
              type="button"
              onClick={() => {
                setDocText("");
                setDocName("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted underline underline-offset-2 hover:text-danger"
            >
              {t.common.remove}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!docText.trim() || submitting}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? empty.uploadStarting : empty.uploadButton}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {t.deliver.wizard.cancel}
        </button>
      </div>
    </div>
  );
}
