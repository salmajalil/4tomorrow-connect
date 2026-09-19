"use client";

import { useState } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/connect/progress-bar";
import {
  IndustryStep,
  PartnerTypesStep,
  ContextStep,
  DescriptionStep,
  ReviewStep,
  type OnboardingState,
} from "@/components/connect/onboarding-steps";
import { MatchingLoadingState, MatchingErrorState } from "@/components/connect/loading-error";
import { MatchResults } from "@/components/connect/match-results";
import { EcosystemBoosters } from "@/components/connect/ecosystem-boosters";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { useLanguage } from "@/components/language-provider";
import type { ModelOutput } from "@/lib/matching";

const TOTAL_STEPS = 5;

type Phase = "form" | "loading" | "results" | "error";

export function ConnectFlow({
  initialIndustry = "",
  initialDescription = "",
  transformationId = null,
}: {
  initialIndustry?: string;
  initialDescription?: string;
  transformationId?: string | null;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("form");
  const [state, setState] = useState<OnboardingState>({
    industry: initialIndustry,
    partnerTypes: [],
    location: "",
    budget: "",
    co2Target: "",
    description: initialDescription,
  });
  const [result, setResult] = useState<ModelOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function launchMatching() {
    setPhase("loading");
    // The API route budgets up to ~170s for the Anthropic call server-side
    // (see MATCHING_TIMEOUT_MS in src/lib/anthropic.ts) inside a 180s
    // function ceiling; this client timeout sits above both so the
    // server's own error message always wins over a raw client-side abort.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 185_000);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, transformationId }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.connect.error.unexpectedError);
      }
      setResult(data as ModelOutput);
      setPhase("results");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? t.connect.error.timedOut
          : err instanceof Error
            ? err.message
            : t.connect.error.unexpectedError;
      setErrorMessage(message);
      setPhase("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <MatchingLoadingState />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <MatchingErrorState message={errorMessage} onRetry={launchMatching} />
      </div>
    );
  }

  if (phase === "results" && result) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">{t.connect.results.title}</h1>
          <div className="flex items-center gap-4">
            <ExportPdfButton
              kind="connect"
              payload={{ result, projectLabel: state.industry || t.connect.results.yourProject }}
              filename="4tomorrow-connect.pdf"
            />
            <button
              type="button"
              onClick={() => {
                setPhase("form");
                setStep(1);
              }}
              className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent"
            >
              {t.connect.results.newMatching}
            </button>
          </div>
        </div>
        <MatchResults result={result} projectLabel={state.industry || t.connect.results.yourProject} />
        <div className="mt-10 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          {t.connect.results.missingPartner}{" "}
          <Link href="/ecosystem/join" className="font-medium text-accent underline underline-offset-2">
            {t.connect.results.addToEcosystem}
          </Link>
          .
        </div>
      </div>
    );
  }

  const canGoNext = step !== 1 || state.industry.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <ProgressBar step={step} total={TOTAL_STEPS} />

      <div className="mt-8">
        {step === 1 && (
          <IndustryStep
            value={state.industry}
            onChange={(industry) => setState((s) => ({ ...s, industry }))}
          />
        )}
        {step === 2 && (
          <PartnerTypesStep
            value={state.partnerTypes}
            onChange={(partnerTypes) => setState((s) => ({ ...s, partnerTypes }))}
          />
        )}
        {step === 3 && (
          <ContextStep
            location={state.location}
            budget={state.budget}
            co2Target={state.co2Target}
            onChangeLocation={(location) => setState((s) => ({ ...s, location }))}
            onChangeBudget={(budget) => setState((s) => ({ ...s, budget }))}
            onChangeCo2Target={(co2Target) => setState((s) => ({ ...s, co2Target }))}
          />
        )}
        {step === 4 && (
          <DescriptionStep
            value={state.description}
            onChange={(description) => setState((s) => ({ ...s, description }))}
          />
        )}
        {step === 5 && <ReviewStep state={state} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted disabled:opacity-0"
        >
          {t.connect.onboarding.back}
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
            disabled={!canGoNext}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.connect.onboarding.continue}
          </button>
        ) : (
          <button
            type="button"
            onClick={launchMatching}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong"
          >
            {t.connect.onboarding.launchMatching}
          </button>
        )}
      </div>

      {step === 1 && (
        <div className="mt-12">
          <EcosystemBoosters />
        </div>
      )}
    </div>
  );
}
