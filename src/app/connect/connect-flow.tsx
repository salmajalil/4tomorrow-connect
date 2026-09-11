"use client";

import { useState } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/connect/progress-bar";
import {
  IndustryStep,
  PartnerTypesStep,
  DescriptionStep,
  ReviewStep,
  type OnboardingState,
} from "@/components/connect/onboarding-steps";
import { MatchingLoadingState, MatchingErrorState } from "@/components/connect/loading-error";
import { MatchResults } from "@/components/connect/match-results";
import type { ModelOutput } from "@/lib/matching";

const TOTAL_STEPS = 4;

type Phase = "form" | "loading" | "results" | "error";

export function ConnectFlow() {
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("form");
  const [state, setState] = useState<OnboardingState>({
    industry: "",
    partnerTypes: [],
    description: "",
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
        body: JSON.stringify(state),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Une erreur inattendue est survenue.");
      }
      setResult(data as ModelOutput);
      setPhase("results");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Le matching a pris trop de temps. Réessaie."
          : err instanceof Error
            ? err.message
            : "Une erreur inattendue est survenue.";
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
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900">Tes résultats</h1>
          <button
            type="button"
            onClick={() => {
              setPhase("form");
              setStep(1);
            }}
            className="text-sm font-medium text-neutral-600 underline underline-offset-2"
          >
            Nouveau matching
          </button>
        </div>
        <MatchResults result={result} />
        <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
          Un partenaire manque à l&apos;appel ?{" "}
          <Link href="/ecosystem/join" className="font-medium text-neutral-900 underline underline-offset-2">
            Ajoute-le à l&apos;écosystème
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
          <DescriptionStep
            value={state.description}
            onChange={(description) => setState((s) => ({ ...s, description }))}
          />
        )}
        {step === 4 && <ReviewStep state={state} />}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 disabled:opacity-0"
        >
          Retour
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
            disabled={!canGoNext}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            onClick={launchMatching}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Lancer le matching
          </button>
        )}
      </div>
    </div>
  );
}
