"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";

export function ManualStartForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const empty = t.deliver.empty;
  const intake = t.decide.intake;

  const [open, setOpen] = useState(false);
  const [organization, setOrganization] = useState("");
  const [industry, setIndustry] = useState("");
  const [challenges, setChallenges] = useState("");
  const [objectives, setObjectives] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = (challenges.trim() || objectives.trim()) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/manual-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization, industry, challenges, objectives }),
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-strong"
      >
        {empty.orManualEntry}
      </button>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 text-left">
      <div>
        <h2 className="font-display text-lg text-ink">{empty.manualEntryTitle}</h2>
        <p className="mt-1 text-sm text-muted">{empty.manualEntrySubtitle}</p>
      </div>

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

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.challenges}</span>
        <textarea
          value={challenges}
          onChange={(e) => setChallenges(e.target.value)}
          placeholder={intake.challengesPlaceholder}
          rows={4}
          className="resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">{intake.objectives}</span>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          placeholder={intake.objectivesPlaceholder}
          rows={3}
          className="resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? empty.manualEntrySubmitting : empty.manualEntrySubmit}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {empty.manualEntryCancel}
        </button>
      </div>
    </div>
  );
}
