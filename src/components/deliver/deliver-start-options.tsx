"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { ConnectToDecide } from "@/components/deliver/connect-to-decide";
import { DiagnosticAssessmentWizard } from "@/components/deliver/diagnostic-assessment-wizard";

type Panel = "connect" | "manual" | null;

// The three ways to get a Deliver project going, mirroring the reference
// product's Input Hub: go through Decide the normal way, auto-connect an
// already-started Decide diagnostic that never had a scenario chosen
// ("Connect to Decide" — candidates is empty when there's nothing to
// connect, so that option simply doesn't render), or fill in the
// standalone Diagnostic Assessment wizard when there's no Decide project
// at all, or the user wants to start fresh.
export function DeliverStartOptions({ candidates }: { candidates: { id: string; title: string }[] }) {
  const { t } = useLanguage();
  const empty = t.deliver.empty;
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{empty.optionsIntro}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/decide"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong"
        >
          {empty.goToDecide}
        </Link>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={() => setPanel(panel === "connect" ? null : "connect")}
            className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition ${
              panel === "connect"
                ? "border-accent bg-accent text-accent-ink"
                : "border-accent text-accent hover:bg-accent hover:text-accent-ink"
            }`}
          >
            {empty.connectOption}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPanel(panel === "manual" ? null : "manual")}
          className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition ${
            panel === "manual"
              ? "border-accent bg-accent text-accent-ink"
              : "border-border text-ink hover:border-accent/60"
          }`}
        >
          {empty.manualOption}
        </button>
      </div>

      <div className="flex w-full flex-col text-xs text-muted">
        <div className="flex flex-wrap justify-center gap-6 text-center">
          <span className="max-w-[13rem]">{empty.classicOptionDesc}</span>
          {candidates.length > 0 && <span className="max-w-[13rem]">{empty.connectOptionDesc}</span>}
          <span className="max-w-[13rem]">{empty.manualOptionDesc}</span>
        </div>
      </div>

      {panel === "connect" && candidates.length > 0 && (
        <ConnectToDecide candidates={candidates} onCancel={() => setPanel(null)} />
      )}
      {panel === "manual" && <DiagnosticAssessmentWizard onCancel={() => setPanel(null)} />}
    </div>
  );
}
