"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { nextReviewStatus, type ReviewStatus } from "@/lib/review-status";

export type ReviewTarget = "deliverable" | "business_case";

export type ReviewState = {
  review_status: ReviewStatus;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
};

const BADGE_CLASS: Record<ReviewStatus, string> = {
  ai_draft: "border border-dashed border-accent/60 bg-accent/10 text-accent-strong",
  reviewed: "border border-accent bg-accent/15 text-accent-strong",
  validated: "border border-success/50 bg-success/15 text-success",
};

// Confiance v2 (benchmark ClearPoint AI / Power BI endorsement) — badge
// « Brouillon IA » / « Revu » / « Validé » + le seul bouton qui fait monter
// le statut d'un cran (POST /api/review-status). Le bouton n'apparaît que
// pour celui qui peut relire (canReview, calculé côté serveur) ; personne
// d'autre — et jamais l'IA — ne change ce statut.
export function ReviewStatusBar({
  target,
  id,
  state,
  canReview,
  aiGenerated = true,
  onChange,
}: {
  target: ReviewTarget;
  id: string;
  state: ReviewState;
  canReview: boolean;
  /** false pour un contenu saisi/calculé (business case) : le badge dit « Brouillon », pas « Brouillon IA ». */
  aiGenerated?: boolean;
  onChange?: (next: ReviewState) => void;
}) {
  const { t, language } = useLanguage();
  const r = t.trust.review;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const status = state.review_status;
  const next = nextReviewStatus(status);
  const label = status === "ai_draft" ? (aiGenerated ? r.aiDraft : r.draft) : status === "reviewed" ? r.reviewed : r.validated;
  const date = state.reviewed_at
    ? new Date(state.reviewed_at).toLocaleDateString(language === "en" ? "en-US" : "fr-FR", { dateStyle: "medium" })
    : null;
  const who = state.reviewed_by_name || r.unknownReviewer;
  const detail =
    status === "validated" && date
      ? r.validatedBy.replace("{name}", who).replace("{date}", date)
      : status === "reviewed" && date
        ? r.reviewedBy.replace("{name}", who).replace("{date}", date)
        : status === "ai_draft"
          ? aiGenerated
            ? r.aiDraftHint
            : r.draftHint
          : null;

  async function advance() {
    if (!next) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/review-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, id, status: next }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || r.saveError);
      const review = data.review as ReviewState;
      onChange?.({
        review_status: review.review_status,
        reviewed_by_name: review.reviewed_by_name,
        reviewed_at: review.reviewed_at,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : r.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${BADGE_CLASS[status]}`}>
          {label}
        </span>
        {detail && <span className="text-xs text-muted">{detail}</span>}
        {canReview && next && (
          <button
            type="button"
            onClick={() => void advance()}
            disabled={saving}
            className={`ml-auto shrink-0 rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
              next === "validated" ? "bg-success text-bg" : "border border-accent text-accent-strong hover:bg-accent/10"
            }`}
          >
            {saving ? r.saving : next === "reviewed" ? r.markReviewed : r.validate}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
