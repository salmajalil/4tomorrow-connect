"use client";

import { useState } from "react";
import { DeliverHeader, type MissionPhase } from "@/components/deliver/deliver-header";
import { InputsTab } from "@/components/deliver/inputs-tab";
import { DeliverablesTab } from "@/components/deliver/deliverables-tab";
import { ControlTowerTab } from "@/components/deliver/control-tower-tab";
import { BenefitsTab } from "@/components/deliver/benefits-tab";
import { ModuleCrossLinks } from "@/components/module-cross-links";
import { ReviewStatusBar } from "@/components/review-status";
import { normalizeReviewStatus } from "@/lib/review-status";
import { DELIVERABLE_KINDS, DELIVERABLE_LABELS, type DeliverableKind } from "@/lib/deliver";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { BenefitExpectation, BenefitItem, BenefitObservation, Deliverable, RoadmapPhaseEntry } from "@/types/database";
import type { Domain } from "@/lib/decide";

type Tab = "inputs" | "deliverables" | "control-tower" | "benefits";

function tabs(t: Dictionary["deliver"]["tabs"]): { id: Tab; label: string }[] {
  return [
    { id: "inputs", label: t.inputs },
    { id: "deliverables", label: t.deliverables },
    { id: "control-tower", label: t.controlTower },
    { id: "benefits", label: t.benefits },
  ];
}

function missionPhase(readyCount: number): MissionPhase {
  if (readyCount === 0) return "DISCOVERY";
  if (readyCount < DELIVERABLE_KINDS.length) return "EXECUTION";
  return "COMPLETE";
}

export function DeliverFlow({
  transformationId,
  organizationId,
  projectTitle,
  organization,
  industry,
  domains,
  initialConstraints,
  initialDeliverables,
  canReview,
  hiddenDraftKinds,
  roadmapPhases,
  priorities,
  initialBenefitExpectation,
  initialBenefitItems,
  initialBenefitObservations,
  indicatorNames,
}: {
  transformationId: string;
  organizationId: string;
  projectTitle: string;
  organization: string;
  industry: string;
  domains: Domain[];
  initialConstraints: string;
  initialDeliverables: Partial<Record<DeliverableKind, Deliverable>>;
  /** Propriétaire / consultant : voit les brouillons IA et peut les marquer revus / validés. */
  canReview: boolean;
  /** Livrables existants mais masqués à ce lecteur car encore en brouillon IA. */
  hiddenDraftKinds: DeliverableKind[];
  roadmapPhases: RoadmapPhaseEntry[];
  priorities: { id: string; name: string; reason: string | null }[];
  initialBenefitExpectation: BenefitExpectation | null;
  initialBenefitItems: BenefitItem[];
  initialBenefitObservations: BenefitObservation[];
  indicatorNames: string[];
}) {
  const { t } = useLanguage();
  const TABS = tabs(t.deliver.tabs);
  const [tab, setTab] = useState<Tab>("inputs");
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [sourceDocText, setSourceDocText] = useState("");
  const [documentCount, setDocumentCount] = useState(0);

  const readyCount = DELIVERABLE_KINDS.filter((k) => deliverables[k]).length;
  const executiveReport = deliverables.executive_report;
  const readinessPercent = Math.round((readyCount / DELIVERABLE_KINDS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-4">
        <ModuleCrossLinks current="deliver" transformationId={transformationId} />
      </div>
      <DeliverHeader
        projectTitle={projectTitle}
        organization={organization}
        industry={industry}
        phase={missionPhase(readyCount)}
      />

      <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            role="tab"
            aria-selected={tab === tabDef.id}
            onClick={() => setTab(tabDef.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === tabDef.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "inputs" && (
          <InputsTab
            transformationId={transformationId}
            organizationId={organizationId}
            initialConstraints={initialConstraints}
            initialIndustry={industry}
            domains={domains}
            documentCount={documentCount}
            onDocumentAdded={(text) => {
              setSourceDocText((prev) => (prev ? `${prev}\n\n${text}` : text));
              setDocumentCount((n) => n + 1);
            }}
          />
        )}

        {tab === "deliverables" && executiveReport && (
          <div className="mb-4 rounded-xl border border-border bg-surface p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">
              {DELIVERABLE_LABELS.executive_report}
            </p>
            <ReviewStatusBar
              key={`${executiveReport.id}-${executiveReport.review_status}`}
              target="deliverable"
              id={executiveReport.id}
              state={{
                review_status: normalizeReviewStatus(executiveReport.review_status),
                reviewed_by_name: executiveReport.reviewed_by_name ?? null,
                reviewed_at: executiveReport.reviewed_at ?? null,
              }}
              canReview={canReview}
              onChange={(review) =>
                setDeliverables((prev) =>
                  prev.executive_report ? { ...prev, executive_report: { ...prev.executive_report, ...review } } : prev
                )
              }
            />
          </div>
        )}

        {tab === "deliverables" && !executiveReport && hiddenDraftKinds.includes("executive_report") && (
          <p className="mb-4 rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-xs text-muted">
            {DELIVERABLE_LABELS.executive_report} — {t.trust.review.hiddenDraft}
          </p>
        )}

        {tab === "deliverables" && (
          <DeliverablesTab
            transformationId={transformationId}
            deliverables={deliverables}
            onDeliverablesChange={setDeliverables}
            roadmapPhases={roadmapPhases}
            sourceDocText={sourceDocText}
            indicatorNames={indicatorNames}
          />
        )}

        {tab === "control-tower" && (
          <ControlTowerTab
            transformationId={transformationId}
            readinessPercent={readinessPercent}
            deliverablesReady={readyCount}
            priorities={priorities}
            milestonesCount={roadmapPhases.length}
          />
        )}

        {tab === "benefits" && (
          <BenefitsTab
            transformationId={transformationId}
            initialExpectation={initialBenefitExpectation}
            initialItems={initialBenefitItems}
            initialObservations={initialBenefitObservations}
            roadmapPhases={roadmapPhases}
          />
        )}
      </div>
    </div>
  );
}
