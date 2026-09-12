"use client";

import { useState } from "react";
import { DELIVERABLE_KINDS, DELIVERABLE_LABELS, type DeliverableKind } from "@/lib/deliver";
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

const KIND_ICONS: Record<DeliverableKind, string> = {
  roadmap: "🗺️",
  action_plan: "✅",
  kpi_dashboard: "📊",
  risk_map: "⚠️",
  executive_report: "📄",
  toolkit: "🧰",
};

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
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">{content.summary}</p>
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
  const { t } = useLanguage();
  const d = t.deliver.deliverables;
  const [generatingKind, setGeneratingKind] = useState<DeliverableKind | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [openKind, setOpenKind] = useState<DeliverableKind | null>(null);
  const [error, setError] = useState("");

  const readyCount = DELIVERABLE_KINDS.filter((k) => deliverables[k]).length;

  async function generateOne(kind: DeliverableKind) {
    setGeneratingKind(kind);
    setError("");
    try {
      const res = await fetch("/api/deliver/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, kind, sourceDocText }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      onDeliverablesChange({ ...deliverables, [kind]: data.deliverable as Deliverable });
      setOpenKind(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
    } finally {
      setGeneratingKind(null);
    }
  }

  async function boostAll() {
    setBoosting(true);
    setError("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.anErrorOccurred);
    } finally {
      setBoosting(false);
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
          return (
            <div key={kind} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg">
                  {KIND_ICONS[kind]}
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
                    onClick={() => generateOne(kind)}
                    disabled={generatingKind === kind}
                    className="shrink-0 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
                  >
                    {generatingKind === kind ? "..." : d.generate}
                  </button>
                )}
              </div>
              {isOpen && deliverable && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 font-display text-lg text-ink">{deliverable.title}</p>
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
