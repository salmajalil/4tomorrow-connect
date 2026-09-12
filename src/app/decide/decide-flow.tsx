"use client";

import { useState } from "react";
import { IntakeForm, type IntakeState } from "@/components/decide/intake-form";
import { DiagnosticView, type DiagnosticResult } from "@/components/decide/diagnostic-view";
import { RadarChart } from "@/components/decide/radar-chart";
import { ScenarioCard, type ScenarioWithId } from "@/components/decide/scenario-card";
import { RoadmapView, type RoadmapPhase } from "@/components/decide/roadmap-view";
import { Eyebrow } from "@/components/eyebrow";
import type { Domain } from "@/lib/decide";

type Phase = "intake" | "diagnostic-loading" | "diagnostic" | "scenarios-loading" | "scenarios" | "roadmap";

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

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/40 bg-danger/10 px-6 py-12 text-center">
      <p className="max-w-sm text-sm text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      >
        Réessayer
      </button>
    </div>
  );
}

// Picks a human label for the "5th" radar/slider axis based on detected
// domains, since the brief explicitly forbids hard-coding "CO2" for
// non-industrial subjects.
function fifthAxisLabel(domains: Domain[]): string {
  if (domains.includes("manufacturing") || domains.includes("strategy")) return "CO2 / durabilité";
  if (domains.includes("digitalization")) return "Rapidité";
  if (domains.includes("gtm")) return "Scalabilité";
  return "CO2 / durabilité (ou équivalent)";
}

export function DecideFlow() {
  const [phase, setPhase] = useState<Phase>("intake");
  const [diagnosticError, setDiagnosticError] = useState("");
  const [scenariosError, setScenariosError] = useState("");
  const [scenariosWarning, setScenariosWarning] = useState("");
  const [roadmapError, setRoadmapError] = useState("");
  const [roadmapGenerating, setRoadmapGenerating] = useState(false);
  const [lastIntake, setLastIntake] = useState<IntakeState | null>(null);

  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioWithId[] | null>(null);
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null);
  const [roadmapPhases, setRoadmapPhases] = useState<RoadmapPhase[]>([]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      setDiagnostic(data as DiagnosticResult);
      setPhase("diagnostic");
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : "Une erreur est survenue.");
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
        setScenarios(data.scenarios as ScenarioWithId[]);
        if (data.warning) setScenariosWarning(data.warning as string);
        setPhase("scenarios");
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setScenariosError(
          isNetworkError
            ? "La connexion a été coupée pendant la génération (réseau mobile instable sur une requête longue). Réessaie, idéalement en Wi-Fi."
            : err instanceof Error
              ? err.message
              : "Une erreur est survenue."
        );
        setPhase("scenarios-loading");
        return;
      }
    }
  }

  async function runRoadmap(params: {
    trajectoryId: string;
    startDate: string;
    priorityCost: number;
    priorityCo2: number;
    priorityRisk: number;
    prioritySpeed: number;
  }) {
    setRoadmapGenerating(true);
    setRoadmapError("");
    try {
      const res = await fetch("/api/decide/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      setRoadmapPhases(data.phases as RoadmapPhase[]);
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRoadmapGenerating(false);
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
          <ErrorBlock message={diagnosticError} onRetry={() => lastIntake && runDiagnostic(lastIntake)} />
        ) : (
          <LoadingBlock
            label="Diagnostic en cours..."
            hint="Détection du type de défi et lecture de maturité — quelques secondes."
          />
        )}
      </div>
    );
  }

  if (phase === "diagnostic" && diagnostic) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <DiagnosticView result={diagnostic} onGenerateScenarios={runScenarios} generating={false} />
      </div>
    );
  }

  if (phase === "scenarios-loading") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {scenariosError ? (
          <ErrorBlock message={scenariosError} onRetry={runScenarios} />
        ) : (
          <LoadingBlock
            label="Construction des 3 scénarios..."
            hint="Recherche de fournisseurs et régulations réels — ça peut prendre 1 à 2 minutes."
          />
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
        <Eyebrow>Scénarios stratégiques</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Trois trajectoires possibles</h1>

        {scenariosWarning && (
          <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-ink">
            {scenariosWarning}
          </p>
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
              selected={selectedTrajectoryId === s.trajectoryId}
              onSelect={() => {
                setSelectedTrajectoryId(s.trajectoryId);
                setPhase("roadmap");
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "roadmap" && selectedTrajectoryId && diagnostic) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <button
          type="button"
          onClick={() => setPhase("scenarios")}
          className="mb-4 text-sm text-muted underline underline-offset-2 hover:text-accent"
        >
          ← Retour aux scénarios
        </button>
        <RoadmapView
          trajectoryId={selectedTrajectoryId}
          co2SliderLabel={fifthAxisLabel(diagnostic.domains)}
          phases={roadmapPhases}
          onGenerate={runRoadmap}
          generating={roadmapGenerating}
          error={roadmapError}
        />
      </div>
    );
  }

  return null;
}
