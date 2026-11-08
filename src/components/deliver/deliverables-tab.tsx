"use client";

import { Icon, type IconName } from "@/components/icons";
import { useState } from "react";
import { DELIVERABLE_KINDS, DELIVERABLE_LABELS, getDeliverableInputFields, type DeliverableKind } from "@/lib/deliver";
import { ExecutionGantt } from "@/components/deliver/execution-gantt";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type {
  Deliverable,
  DeliverableActionPlanContent,
  DeliverableKpiDashboardContent,
  DeliverableRiskMapContent,
  DeliverableExecutiveReportContent,
  DeliverableToolkitContent,
  RoadmapPhaseEntry,
} from "@/types/database";

const KIND_ICONS: Record<DeliverableKind, IconName> = {
  roadmap: "map",
  action_plan: "checklist",
  kpi_dashboard: "chart",
  risk_map: "alert",
  executive_report: "document",
  toolkit: "toolbox",
};

// The AI writes `summary` as a free-form multi-paragraph essay (unlike
// `keyPoints`, which is already a short list) — shown in full by default it
// was exactly the kind of "pavé" (wall of text) the gabarit asks to avoid.
// Same line-clamp + toggle pattern already used by scenario-card.tsx.
function ExecutiveReportContent({
  content,
  d,
}: {
  content: DeliverableExecutiveReportContent;
  d: Dictionary["deliver"]["deliverables"];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className={`text-sm leading-relaxed text-ink ${expanded ? "" : "line-clamp-3"}`}>{content.summary}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          {expanded ? d.readLess : d.readMore}
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {content.keyPoints.map((k, i) => (
          <li key={i} className="rounded-lg border border-border bg-surface-2 p-2.5 text-sm text-ink">
            {k}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The "Transformation Roadmap" deliverable's detail view IS the co-
// constructed execution Gantt (see execution-gantt.tsx's comment on why
// this isn't a 4th tab). Every other kind gets a straightforward content
// render matching its own schema shape in src/lib/deliver.ts.
function DeliverableContentView({
  kind,
  deliverable,
  roadmapPhases,
  transformationId,
  d,
}: {
  kind: DeliverableKind;
  deliverable: Deliverable;
  roadmapPhases: RoadmapPhaseEntry[];
  transformationId: string;
  d: Dictionary["deliver"]["deliverables"];
}) {
  if (kind === "roadmap") {
    return <ExecutionGantt transformationId={transformationId} initialPhases={roadmapPhases} />;
  }

  if (kind === "action_plan") {
    const content = deliverable.content as DeliverableActionPlanContent;
    return (
      <div className="flex flex-col gap-2">
        {content.actions.map((a, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <p className="font-semibold text-ink">{a.title}</p>
            <p className="mt-1 text-muted">{a.description}</p>
            <p className="mt-1 text-xs text-muted">
              {a.ownerSuggestion} · {a.timeframe}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "kpi_dashboard") {
    const content = deliverable.content as DeliverableKpiDashboardContent;
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {content.kpis.map((k, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">{k.name}</p>
              <span
                className={`text-[10px] font-semibold uppercase ${
                  k.source === "trajectory" ? "text-success" : "text-accent-strong"
                }`}
              >
                {k.source === "trajectory" ? d.decideSource : d.estimateSource}
              </span>
            </div>
            <p className="mt-1 text-ink">
              {d.target} {k.target} {k.unit}
            </p>
            {k.current && (
              <p className="text-xs text-muted">
                {d.current} {k.current} {k.unit}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (kind === "risk_map") {
    const content = deliverable.content as DeliverableRiskMapContent;
    return (
      <div className="flex flex-col gap-2">
        {content.risks.map((r, i) => (
          <div key={i} className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">{r.name}</p>
              <span className="text-xs text-muted">
                {d.likelihood} {r.likelihood} · {d.impact} {r.impact}
              </span>
            </div>
            <p className="mt-1 text-muted">{r.description}</p>
            <p className="mt-1 text-xs text-ink">{d.mitigation} {r.mitigation}</p>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "executive_report") {
    const content = deliverable.content as DeliverableExecutiveReportContent;
    return <ExecutiveReportContent content={content} d={d} />;
  }

  const content = deliverable.content as DeliverableToolkitContent;
  return (
    <div className="flex flex-col gap-2">
      {content.tools.map((t, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-ink">{t.name}</p>
          <p className="mt-1 text-muted">{t.purpose}</p>
          <p className="mt-1 text-xs text-ink">{t.whyThisProject}</p>
        </div>
      ))}
    </div>
  );
}

// The guided questionnaire shown inline on a card before its first
// generation — replaces the old one-click blind "Générer". Every field is
// optional; "Générer sans répondre" keeps the original one-click behavior
// available for anyone who wants to skip straight past it.
function DeliverableInputsForm({
  kind,
  language,
  values,
  onChange,
  onSubmit,
  onSkip,
  onCancel,
  hasDocuments,
  submitting,
  d,
}: {
  kind: DeliverableKind;
  language: "fr" | "en";
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onCancel: () => void;
  hasDocuments: boolean;
  submitting: boolean;
  d: Dictionary["deliver"]["deliverables"];
}) {
  const fields = getDeliverableInputFields(kind, language);
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-semibold text-ink">{d.inputsTitle}</p>
      <p className="mt-1 text-xs text-muted">{d.inputsSubtitle}</p>
      {hasDocuments && <p className="mt-2 text-xs text-accent-strong">{d.inputsDocHint}</p>}
      <div className="mt-3 flex flex-col gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted">
              {f.label} <span className="text-muted/70">({d.inputsOptional})</span>
            </label>
            {f.multiline ? (
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            ) : (
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          {submitting ? "..." : d.inputsSubmit}
        </button>
        <button type="button" onClick={onSkip} disabled={submitting} className="text-xs font-semibold text-accent underline underline-offset-2">
          {d.inputsSkip}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="text-xs text-muted underline underline-offset-2">
          {d.inputsCancel}
        </button>
      </div>
    </div>
  );
}

export function DeliverablesTab({
  transformationId,
  deliverables,
  onDeliverablesChange,
  roadmapPhases,
  sourceDocText,
}: {
  transformationId: string;
  deliverables: Partial<Record<DeliverableKind, Deliverable>>;
  onDeliverablesChange: (next: Partial<Record<DeliverableKind, Deliverable>>) => void;
  roadmapPhases: RoadmapPhaseEntry[];
  sourceDocText: string;
}) {
  const { t, language } = useLanguage();
  const d = t.deliver.deliverables;
  const [generatingKind, setGeneratingKind] = useState<DeliverableKind | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [openKind, setOpenKind] = useState<DeliverableKind | null>(null);
  const [formOpenKind, setFormOpenKind] = useState<DeliverableKind | null>(null);
  const [draftInputs, setDraftInputs] = useState<Partial<Record<DeliverableKind, Record<string, string>>>>({});
  const [error, setError] = useState("");

  const readyCount = DELIVERABLE_KINDS.filter((k) => deliverables[k]).length;

  // Same network-drop retry as Decide's scenarios call — a long AI
  // generation can see the connection dropped by mobile Safari mid-flight
  // even when the server finishes cleanly; only that network-level failure
  // (TypeError), never a real server error, gets an automatic retry.
  async function generateOne(kind: DeliverableKind, inputs: Record<string, string> = {}) {
    setGeneratingKind(kind);
    setError("");
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("/api/deliver/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transformationId, kind, sourceDocText, inputs }),
        });
        const { data } = await parseJsonResponse(res);
        if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
        onDeliverablesChange({ ...deliverables, [kind]: data.deliverable as Deliverable });
        setFormOpenKind(null);
        setOpenKind(kind);
        setGeneratingKind(null);
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setError(isNetworkError ? t.common.networkErrorRetry : err instanceof Error ? err.message : t.common.anErrorOccurred);
        setGeneratingKind(null);
        return;
      }
    }
  }

  async function boostAll() {
    setBoosting(true);
    setError("");
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("/api/deliver/boost-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transformationId, sourceDocText }),
        });
        const { data } = await parseJsonResponse(res);
        if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
        const next = { ...deliverables };
        for (const gen of (data.deliverables as Deliverable[]) ?? []) next[gen.kind] = gen;
        onDeliverablesChange(next);
        if (data.warning) setError(data.warning as string);
        setBoosting(false);
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setError(isNetworkError ? t.common.networkErrorRetry : err instanceof Error ? err.message : t.common.anErrorOccurred);
        setBoosting(false);
        return;
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <h3 className="font-semibold text-ink">{d.boosterTitle}</h3>
        <p className="mt-1 text-xs text-muted">{d.boosterSubtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={boostAll}
            disabled={boosting || readyCount === DELIVERABLE_KINDS.length}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {boosting ? d.generating : d.boostAll}
          </button>
          <span className="text-xs font-semibold text-muted">
            {readyCount}/{DELIVERABLE_KINDS.length} {d.ready} · {DELIVERABLE_KINDS.length - readyCount} {d.remaining}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        {DELIVERABLE_KINDS.map((kind) => {
          const deliverable = deliverables[kind];
          const isOpen = openKind === kind;
          const isFormOpen = formOpenKind === kind;
          const filledInputs = deliverable ? Object.entries(deliverable.inputs ?? {}).filter(([, v]) => v.trim()) : [];
          return (
            <div key={kind} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
                  <Icon name={KIND_ICONS[kind]} className="h-5 w-5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{DELIVERABLE_LABELS[kind]}</p>
                  <p className="text-xs text-muted">{deliverable ? d.generated : d.notGenerated}</p>
                </div>
                {deliverable ? (
                  <button
                    type="button"
                    onClick={() => setOpenKind(isOpen ? null : kind)}
                    className="shrink-0 rounded-lg border border-accent px-4 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-ink"
                  >
                    {isOpen ? d.close : d.view}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormOpenKind(isFormOpen ? null : kind)}
                    disabled={generatingKind === kind}
                    className="shrink-0 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
                  >
                    {generatingKind === kind ? "..." : d.generate}
                  </button>
                )}
              </div>
              {isFormOpen && !deliverable && (
                <DeliverableInputsForm
                  kind={kind}
                  language={language}
                  values={draftInputs[kind] ?? {}}
                  onChange={(key, value) =>
                    setDraftInputs((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: value } }))
                  }
                  onSubmit={() => generateOne(kind, draftInputs[kind] ?? {})}
                  onSkip={() => generateOne(kind, {})}
                  onCancel={() => setFormOpenKind(null)}
                  hasDocuments={sourceDocText.trim().length > 0}
                  submitting={generatingKind === kind}
                  d={d}
                />
              )}
              {isOpen && deliverable && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 font-display text-lg text-ink">{deliverable.title}</p>
                  {filledInputs.length > 0 && (
                    <details className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-accent-strong">{d.basedOnInputs}</summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {filledInputs.map(([key, value]) => {
                          const field = getDeliverableInputFields(kind, language).find((f) => f.key === key);
                          return (
                            <li key={key} className="text-xs text-muted">
                              <span className="font-medium text-ink">{field?.label ?? key} :</span> {value}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}
                  <DeliverableContentView
                    kind={kind}
                    deliverable={deliverable}
                    roadmapPhases={roadmapPhases}
                    transformationId={transformationId}
                    d={d}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
