"use client";

import { useState } from "react";
import { DeliverHeader, type MissionPhase } from "@/components/deliver/deliver-header";
import { InputsTab } from "@/components/deliver/inputs-tab";
import { DeliverablesTab } from "@/components/deliver/deliverables-tab";
import { ControlTowerTab } from "@/components/deliver/control-tower-tab";
import { ModuleCrossLinks } from "@/components/module-cross-links";
import { DELIVERABLE_KINDS, type DeliverableKind } from "@/lib/deliver";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Deliverable, RoadmapPhaseEntry } from "@/types/database";
import type { Domain } from "@/lib/decide";

type Tab = "inputs" | "deliverables" | "control-tower";

function tabs(t: Dictionary["deliver"]["tabs"]): { id: Tab; label: string }[] {
  return [
    { id: "inputs", label: t.inputs },
    { id: "deliverables", label: t.deliverables },
    { id: "control-tower", label: t.controlTower },
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
  roadmapPhases,
  priorities,
}: {
  transformationId: string;
  organizationId: string;
  projectTitle: string;
  organization: string;
  industry: string;
  domains: Domain[];
  initialConstraints: string;
  initialDeliverables: Partial<Record<DeliverableKind, Deliverable>>;
  roadmapPhases: RoadmapPhaseEntry[];
  priorities: { id: string; name: string; reason: string | null }[];
}) {
  const { t } = useLanguage();
  const TABS = tabs(t.deliver.tabs);
  const [tab, setTab] = useState<Tab>("inputs");
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [sourceDocText, setSourceDocText] = useState("");
  const [documentCount, setDocumentCount] = useState(0);

  const readyCount = DELIVERABLE_KINDS.filter((k) => deliverables[k]).length;
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

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
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

        {tab === "deliverables" && (
          <DeliverablesTab
            transformationId={transformationId}
            deliverables={deliverables}
            onDeliverablesChange={setDeliverables}
            roadmapPhases={roadmapPhases}
            sourceDocText={sourceDocText}
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
      </div>
    </div>
  );
}
