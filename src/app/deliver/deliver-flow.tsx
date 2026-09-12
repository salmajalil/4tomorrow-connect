"use client";

import { useState } from "react";
import { DeliverHeader, type MissionPhase } from "@/components/deliver/deliver-header";
import { InputsTab } from "@/components/deliver/inputs-tab";
import { DeliverablesTab } from "@/components/deliver/deliverables-tab";
import { ControlTowerTab } from "@/components/deliver/control-tower-tab";
import { DELIVERABLE_KINDS, type DeliverableKind } from "@/lib/deliver";
import type { Deliverable, RoadmapPhaseEntry } from "@/types/database";
import type { Domain } from "@/lib/decide";

const TABS = [
  { id: "inputs", label: "Inputs" },
  { id: "deliverables", label: "Deliverables" },
  { id: "control-tower", label: "Control Tower" },
] as const;
type Tab = (typeof TABS)[number]["id"];

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
  const [tab, setTab] = useState<Tab>("inputs");
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [sourceDocText, setSourceDocText] = useState("");
  const [documentCount, setDocumentCount] = useState(0);

  const readyCount = DELIVERABLE_KINDS.filter((k) => deliverables[k]).length;
  const readinessPercent = Math.round((readyCount / DELIVERABLE_KINDS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <DeliverHeader
        projectTitle={projectTitle}
        organization={organization}
        industry={industry}
        phase={missionPhase(readyCount)}
      />

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
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
