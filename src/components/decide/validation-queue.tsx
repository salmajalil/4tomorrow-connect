"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { IndicatorFeedback, TrajectoryIndicators } from "@/types/database";

// One figure at a time instead of a wall of forms: the estimate is shown
// openly as an order of magnitude (reassuring, never presented as a fact),
// and three answers move it on — Confirm keeps the value and marks it
// verified, Correct records the client's own value, "I don't know" leaves
// it as an estimate. Every answer is written to the trajectory, exactly as
// the previous per-figure notes did.
export function ValidationQueue({
  trajectoryId,
  indicators,
  feedback,
  onChange,
  t,
}: {
  trajectoryId: string;
  indicators: TrajectoryIndicators;
  feedback: IndicatorFeedback;
  onChange: (next: { indicators: TrajectoryIndicators; feedback: IndicatorFeedback }) => void;
  t: Dictionary;
}) {
  const s = t.decide.scenarios;
  const pendingKeys = Object.entries(indicators)
    .filter(([, e]) => e.confidence !== "verified")
    .map(([k]) => k);
  const total = Object.keys(indicators).length;
  const verified = total - pendingKeys.length;

  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const queue = pendingKeys.filter((k) => !skipped.includes(k));
  const current = queue[0];
  const entry = current ? indicators[current] : null;

  async function record(value: string) {
    if (!current) return;
    setSaving(true);
    const nextIndicators: TrajectoryIndicators = { ...indicators, [current]: { value, confidence: "verified" } };
    const nextFeedback: IndicatorFeedback = {
      ...feedback,
      [current]: [...(feedback[current] ?? []), { note: value, at: new Date().toISOString() }],
    };
    await createClient()
      .from("trajectories")
      .update({ indicators: nextIndicators, indicators_feedback: nextFeedback })
      .eq("id", trajectoryId);
    onChange({ indicators: nextIndicators, feedback: nextFeedback });
    setDraft("");
    setCorrecting(false);
    setSaving(false);
  }

  if (pendingKeys.length === 0) return null;

  return (
    <div className="border border-border bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink">
            <span className="font-display text-2xl text-accent-strong tabular-nums">{pendingKeys.length}</span> {s.queueTitle}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-32 bg-border">
              <div className="h-full bg-success" style={{ width: `${total ? (verified / total) * 100 : 0}%` }} />
            </div>
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {verified} {s.queueProgress} {total}
            </span>
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-accent px-4 py-2 text-sm font-medium text-accent-strong transition hover:bg-accent hover:text-accent-ink"
          >
            {s.queueStart}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          {!current || !entry ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-body">{s.queueDone}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline underline-offset-4">
                {s.queueClose}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{s.queueIntro}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{current}</p>
              {entry.value !== null && entry.value !== "" ? (
                <div>
                  <p className="font-display text-4xl leading-none text-ink">{String(entry.value)}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-strong">{s.queueEstimate}</p>
                </div>
              ) : (
                <p className="text-sm text-body">{s.queueNoEstimate}</p>
              )}

              {correcting || entry.value === null || entry.value === "" ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) record(draft.trim());
                  }}
                >
                  <label className="sr-only" htmlFor={`correct-${trajectoryId}`}>
                    {s.queueCorrectPlaceholder}
                  </label>
                  <input
                    id={`correct-${trajectoryId}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={s.queueCorrectPlaceholder}
                    className="min-w-0 flex-1 border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={saving || !draft.trim()}
                    className="shrink-0 bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-40"
                  >
                    {s.queueSave}
                  </button>
                </form>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {entry.value !== null && entry.value !== "" && !correcting && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => record(String(entry.value))}
                      className="bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-40"
                    >
                      {s.queueConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrecting(true)}
                      className="border border-border-strong px-4 py-2.5 text-sm text-ink"
                    >
                      {s.queueCorrect}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSkipped((prev) => [...prev, current]);
                    setCorrecting(false);
                    setDraft("");
                  }}
                  className="px-4 py-2.5 text-sm text-muted underline-offset-4 hover:underline"
                >
                  {s.queueSkip}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
