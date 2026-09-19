"use client";

import { useState } from "react";
import Link from "next/link";
import { IntakeForm, type IntakeState } from "@/components/decide/intake-form";
import { DiagnosticView, type DiagnosticResult } from "@/components/decide/diagnostic-view";
import { ModuleCrossLinks } from "@/components/module-cross-links";
import { RadarChart } from "@/components/decide/radar-chart";
import { ScenarioCard, type ScenarioWithId } from "@/components/decide/scenario-card";
import { Eyebrow } from "@/components/eyebrow";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { createClient } from "@/lib/supabase/client";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { Domain } from "@/lib/decide";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Phase = "intake" | "diagnostic-loading" | "diagnostic" | "scenarios-loading" | "scenarios" | "scenario-detail";

function LoadingBlock({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-accent" />
      <div>
        <p className="font-display text-xl text-ink">{label}</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{hint}</p>
      </div>
    </div>
  );
}

function ErrorBlock({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/40 bg-danger/10 px-6 py-12 text-center">
      <p className="max-w-sm text-sm text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        {retryLabel}
      </button>
    </div>
  );
}

// Picks a human label for the "5th" radar/slider axis based on detected
// domains, since the brief explicitly forbids hard-coding "CO2" for
// non-industrial subjects.
function fifthAxisLabel(domains: Domain[], axisLabels: Dictionary["decide"]["axisLabels"]): string {
  if (domains.includes("manufacturing") || domains.includes("strategy")) return axisLabels.co2;
  if (domains.includes("digitalization")) return axisLabels.speed;
  if (domains.includes("gtm")) return axisLabels.scalability;
  return axisLabels.co2Fallback;
}

function initialPhase(hasScenarios: boolean, hasDiagnostic: boolean): Phase {
  if (hasScenarios) return "scenarios";
  if (hasDiagnostic) return "diagnostic";
  return "intake";
}

export function DecideFlow({
  initialDiagnostic = null,
  initialScenarios = null,
  initialSelectedTrajectoryId = null,
}: {
  initialDiagnostic?: DiagnosticResult | null;
  initialScenarios?: ScenarioWithId[] | null;
  initialSelectedTrajectoryId?: string | null;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>(initialPhase(!!initialScenarios, !!initialDiagnostic));
  const [diagnosticError, setDiagnosticError] = useState("");
  const [scenariosError, setScenariosError] = useState("");
  const [scenariosWarning, setScenariosWarning] = useState("");
  const [lastIntake, setLastIntake] = useState<IntakeState | null>(null);

  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(initialDiagnostic);
  const [scenarios, setScenarios] = useState<ScenarioWithId[] | null>(initialScenarios);
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(initialSelectedTrajectoryId);
  const [detailTrajectoryId, setDetailTrajectoryId] = useState<string | null>(null);

  // Previously UI-only ("selected" just highlighted a card) — Deliver needs
  // to know which trajectory was actually chosen to know what to execute,
  // so this now persists to transformations.selected_trajectory_id.
  // Escape hatch: /decide now resumes the user's most recent project by
  // default (see decide/page.tsx), so this is the only way back to a blank
  // intake form to start a genuinely different one.
  function startNewDiagnostic() {
    setDiagnostic(null);
    setScenarios(null);
    setSelectedTrajectoryId(null);
    setDetailTrajectoryId(null);
    setDiagnosticError("");
    setScenariosError("");
    setScenariosWarning("");
    setPhase("intake");
  }

  async function selectTrajectory(trajectoryId: string) {
    setSelectedTrajectoryId(trajectoryId);
    if (!diagnostic) return;
    await createClient()
      .from("transformations")
      .update({ selected_trajectory_id: trajectoryId })
      .eq("id", diagnostic.transformationId);
  }

  async function runDiagnostic(intake: IntakeState) {
    setLastIntake(intake);
    setPhase("diagnostic-loading");
    setDiagnosticError("");
    try {
      const res = await fetch("/api/decide/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
      setDiagnostic(data as DiagnosticResult);
      setPhase("diagnostic");
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : t.common.anErrorOccurred);
      setPhase("diagnostic-loading"); // stay, error block replaces spinner below
    }
  }

  async function runScenarios() {
    if (!diagnostic) return;
    setPhase("scenarios-loading");
    setScenariosError("");
    setScenariosWarning("");

    // The scenarios call legitimately takes 60-90s+ (3 parallel web-search
    // backed generations). Over that long a mobile connection can drop
    // mid-flight even when the server finishes cleanly — fetch() then
    // rejects with a network-level TypeError (WebKit's "Load failed"),
    // never reaching the res.ok branch below. That's distinct from a real
    // server error (which returns a JSON body), so only network-level
    // failures get an automatic retry here.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("/api/decide/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transformationId: diagnostic.transformationId }),
        });
        const { data } = await parseJsonResponse(res);
        if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
        setScenarios(data.scenarios as ScenarioWithId[]);
        if (data.warning) setScenariosWarning(data.warning as string);
        setPhase("scenarios");
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setScenariosError(
          isNetworkError
            ? t.decide.networkErrorRetry
            : err instanceof Error
              ? err.message
              : t.common.anErrorOccurred
        );
        setPhase("scenarios-loading");
        return;
      }
    }
  }

  if (phase === "intake") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <IntakeForm onSubmit={runDiagnostic} submitting={false} />
      </div>
    );
  }

  if (phase === "diagnostic-loading") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {diagnosticError ? (
          <ErrorBlock
            message={diagnosticError}
            onRetry={() => lastIntake && runDiagnostic(lastIntake)}
            retryLabel={t.common.retry}
          />
        ) : (
          <LoadingBlock label={t.decide.diagnostic.loadingLabel} hint={t.decide.diagnostic.loadingHint} />
        )}
      </div>
    );
  }

  if (phase === "diagnostic" && diagnostic) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <ModuleCrossLinks current="decide" transformationId={diagnostic.transformationId} />
          <div className="flex shrink-0 items-center gap-3">
            {scenarios && (
              <button
                type="button"
                onClick={() => setPhase("scenarios")}
                className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent"
              >
                {t.decide.diagnostic.viewScenarios}
              </button>
            )}
            <button
              type="button"
              onClick={startNewDiagnostic}
              className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent"
            >
              {t.decide.diagnostic.newDiagnostic}
            </button>
          </div>
        </div>
        <DiagnosticView result={diagnostic} onGenerateScenarios={runScenarios} generating={false} />
      </div>
    );
  }

  if (phase === "scenarios-loading") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {scenariosError ? (
          <ErrorBlock message={scenariosError} onRetry={runScenarios} retryLabel={t.common.retry} />
        ) : (
          <LoadingBlock label={t.decide.scenarios.loadingLabel} hint={t.decide.scenarios.loadingHint} />
        )}
      </div>
    );
  }

  if (phase === "scenarios" && scenarios && diagnostic) {
    const axes = Array.from(new Set(scenarios.flatMap((s) => Object.keys(s.radarScores))));
    const radarSeries = scenarios.map((s) => ({
      label: s.name,
      values: axes.map((a) => s.radarScores[a] ?? 0),
    }));

    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <ModuleCrossLinks current="decide" transformationId={diagnostic.transformationId} />
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase("diagnostic")}
              className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent"
            >
              {t.decide.scenarios.backToDiagnostic}
            </button>
            <button
              type="button"
              onClick={startNewDiagnostic}
              className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent"
            >
              {t.decide.diagnostic.newDiagnostic}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>{t.decide.scenarios.eyebrow}</Eyebrow>
            <h1 className="mt-3 font-display text-3xl text-ink">{t.decide.scenarios.title}</h1>
          </div>
          <ExportPdfButton
            kind="decide"
            payload={{ diagnostic, scenarios }}
            filename={`4tomorrow-decide-${diagnostic.transformationId}.pdf`}
          />
        </div>

        {scenariosWarning && (
          <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-ink">
            {scenariosWarning}
          </p>
        )}

        {selectedTrajectoryId && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
            <p className="text-sm text-ink">{t.decide.scenarios.trajectoryChosen}</p>
            <Link
              href={`/deliver?transformationId=${diagnostic.transformationId}`}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong"
            >
              {t.decide.scenarios.openDeliver}
            </Link>
          </div>
        )}

        <div className="mt-6">
          <RadarChart axes={axes} series={radarSeries} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {scenarios.map((s, i) => (
            <ScenarioCard
              key={s.trajectoryId}
              scenario={s}
              index={i}
              co2SliderLabel={fifthAxisLabel(diagnostic.domains, t.decide.axisLabels)}
              selected={selectedTrajectoryId === s.trajectoryId}
              onSelect={() => selectTrajectory(s.trajectoryId)}
              onOpenDetail={() => {
                setDetailTrajectoryId(s.trajectoryId);
                setPhase("scenario-detail");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "scenario-detail" && scenarios && diagnostic) {
    const index = scenarios.findIndex((s) => s.trajectoryId === detailTrajectoryId);
    const scenario = index >= 0 ? scenarios[index] : null;
    if (!scenario) {
      setPhase("scenarios");
      return null;
    }

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-4">
          <ModuleCrossLinks current="decide" transformationId={diagnostic.transformationId} />
        </div>
        <button
          type="button"
          onClick={() => setPhase("scenarios")}
          className="mb-4 text-sm text-muted underline underline-offset-2 hover:text-accent"
        >
          {t.decide.scenarios.backToScenarios}
        </button>
        <ScenarioCard
          scenario={scenario}
          index={index}
          co2SliderLabel={fifthAxisLabel(diagnostic.domains, t.decide.axisLabels)}
          selected={selectedTrajectoryId === scenario.trajectoryId}
          onSelect={() => selectTrajectory(scenario.trajectoryId)}
          detail
        />
      </div>
    );
  }

  return null;
}
