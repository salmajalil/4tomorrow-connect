"use client";

import { useState } from "react";
import { LearnIntakeForm, type LearnIntakeState } from "@/components/learn/learn-intake-form";
import { Eyebrow } from "@/components/eyebrow";
import { LearnThemeWrap } from "@/components/learn/learn-theme";
import { TrainingView } from "@/components/learn/training-view";
import { ModuleCrossLinks } from "@/components/module-cross-links";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { useLanguage } from "@/components/language-provider";
import type { Training } from "@/types/database";

type Phase = "intake" | "loading" | "result";

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

export function LearnFlow({
  existingProjects,
  initialTransformationId,
}: {
  existingProjects: { id: string; title: string }[];
  initialTransformationId: string | null;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("intake");
  const [error, setError] = useState("");
  const [lastIntake, setLastIntake] = useState<LearnIntakeState | null>(null);
  const [training, setTraining] = useState<Training | null>(null);
  const [activeTransformationId, setActiveTransformationId] = useState<string | null>(initialTransformationId);

  async function runGenerate(intake: LearnIntakeState) {
    setLastIntake(intake);
    setPhase("loading");
    setError("");

    // Same network-drop retry as Decide's scenarios call — a web-search-
    // backed generation this long can see the connection dropped by
    // mobile Safari mid-flight even when the server finishes cleanly.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("/api/learn/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intake),
        });
        const { data } = await parseJsonResponse(res);
        if (!res.ok) throw new Error((data.error as string) || t.common.anErrorOccurred);
        setTraining(data.training as Training);
        if (data.transformationId) setActiveTransformationId(data.transformationId as string);
        setPhase("result");
        return;
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        if (isNetworkError && attempt < maxAttempts) continue;
        setError(
          isNetworkError
            ? t.decide.networkErrorRetry
            : err instanceof Error
              ? err.message
              : t.common.anErrorOccurred
        );
        setPhase("loading");
        return;
      }
    }
  }

  if (phase === "intake") {
    return (
      <LearnThemeWrap>
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
          <LearnIntakeForm
            onSubmit={runGenerate}
            submitting={false}
            existingProjects={existingProjects}
            initialTransformationId={initialTransformationId}
          />
        </div>
      </LearnThemeWrap>
    );
  }

  if (phase === "loading") {
    return (
      <LearnThemeWrap>
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
          <Eyebrow>Learn</Eyebrow>
          {error ? (
            <div className="mt-6">
              <ErrorBlock
                message={error}
                onRetry={() => lastIntake && runGenerate(lastIntake)}
                retryLabel={t.common.retry}
              />
            </div>
          ) : (
            <LoadingBlock label={t.learn.loading.title} hint={t.learn.loading.hint} />
          )}
        </div>
      </LearnThemeWrap>
    );
  }

  if (phase === "result" && training) {
    return (
      <LearnThemeWrap>
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          {activeTransformationId && (
            <div className="mb-4">
              <ModuleCrossLinks current="learn" transformationId={activeTransformationId} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setPhase("intake")}
            className="mb-4 text-sm text-muted underline underline-offset-2 hover:text-accent"
          >
            {t.learn.training.newTraining}
          </button>
          <TrainingView training={training} />
        </div>
      </LearnThemeWrap>
    );
  }

  return null;
}
