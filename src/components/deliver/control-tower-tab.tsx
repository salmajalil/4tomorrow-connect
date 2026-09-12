"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { DELIVERABLE_KINDS } from "@/lib/deliver";
import { useLanguage } from "@/components/language-provider";
import type { MissionFeedback } from "@/types/database";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className="font-display text-2xl tabular-nums text-ink">{value}</span>
    </div>
  );
}

export function ControlTowerTab({
  transformationId,
  readinessPercent,
  deliverablesReady,
  priorities,
  milestonesCount,
}: {
  transformationId: string;
  readinessPercent: number;
  deliverablesReady: number;
  priorities: { id: string; name: string; reason: string | null }[];
  milestonesCount: number;
}) {
  const { t } = useLanguage();
  const ct = t.deliver.controlTower;
  const [feedbackText, setFeedbackText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<MissionFeedback | null>(null);
  const [applyRoadmap, setApplyRoadmap] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  async function sendFeedback() {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, feedbackText }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      setProposal(data.feedback as MissionFeedback);
      setApplied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
    } finally {
      setSending(false);
    }
  }

  async function applyProposal() {
    if (!proposal) return;
    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/deliver/feedback/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: proposal.id, applyRoadmapAdjustment: applyRoadmap }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      setApplied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={ct.readiness} value={`${readinessPercent}%`} />
        <StatTile label={ct.deliverablesStat} value={`${deliverablesReady}/${DELIVERABLE_KINDS.length}`} />
        <StatTile label={ct.priorities} value={priorities.length} />
        <StatTile label={ct.milestones} value={milestonesCount} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold text-ink">{ct.executionPriorities}</h3>
        {priorities.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{ct.noPriorities}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {priorities.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface-2 p-2.5 text-sm">
                <p className="font-medium text-ink">{p.name}</p>
                {p.reason && <p className="text-xs text-muted">{p.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold text-ink">{ct.feedbackTitle}</h3>
        <p className="mt-1 text-xs text-muted">{ct.feedbackSubtitle}</p>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={3}
          placeholder={ct.feedbackPlaceholder}
          className="mt-3 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={sendFeedback}
          disabled={sending || !feedbackText.trim()}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? ct.analyzing : ct.enterFeedback}
        </button>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        {proposal && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{ct.recommendation}</p>
              <p className="mt-1 text-sm text-ink">{proposal.ai_summary.recommendation}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{ct.updatedPriorities}</p>
              <div className="mt-1 flex flex-col gap-1.5">
                {proposal.ai_summary.updatedPriorities.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface-2 p-2 text-xs">
                    <span className="font-medium text-ink">{p.name}</span> ({p.weight}%) — {p.reason}
                  </div>
                ))}
              </div>
            </div>
            {proposal.ai_summary.roadmapAdjustment?.proposed && (
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                  {ct.roadmapAdjustmentProposed}
                </p>
                <p className="mt-1 text-sm text-ink">{proposal.ai_summary.roadmapAdjustment.note}</p>
                <label className="mt-2 flex items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={applyRoadmap}
                    onChange={(e) => setApplyRoadmap(e.target.checked)}
                  />
                  {ct.alsoApplyRoadmap}
                </label>
              </div>
            )}
            {applied ? (
              <p className="text-sm font-semibold text-success">{ct.applied}</p>
            ) : (
              <button
                type="button"
                onClick={applyProposal}
                disabled={applying}
                className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
              >
                {applying ? ct.applying : ct.apply}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
