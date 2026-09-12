"use client";

import { useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { createClient } from "@/lib/supabase/client";
import { DOMAIN_LABELS, type Domain } from "@/lib/decide";
import type { ModuleRelevance, RecommendableModule } from "@/types/database";

export interface DiagnosticResult {
  transformationId: string;
  domains: Domain[];
  maturityReading: string;
  gaps: { name: string; reason: string }[];
  rootCauses: { name: string; reason: string }[];
  decisionCriteria: string[];
  priorities: { name: string; reason: string; weight: number }[];
  risks: { name: string; reason: string }[];
  startingRecommendation: string;
  moduleRecommendations: Record<RecommendableModule, { relevance: ModuleRelevance; reason: string }>;
}

const MODULE_LABELS: Record<RecommendableModule, string> = {
  connect: "Connect",
  learn: "Learn",
  deliver: "Deliver",
};

function moduleHref(module: RecommendableModule, transformationId: string): string | null {
  if (module === "connect") return "/connect";
  if (module === "learn") return `/learn?transformationId=${transformationId}`;
  if (module === "deliver") return `/deliver?transformationId=${transformationId}`;
  return null;
}

const RELEVANCE_LABELS: Record<ModuleRelevance, string> = {
  relevant: "Pertinent",
  possible: "Possible",
  not_relevant: "Pas pertinent maintenant",
};

function ModuleRecommendationCard({
  module,
  relevance,
  reason,
  transformationId,
}: {
  module: RecommendableModule;
  relevance: ModuleRelevance;
  reason: string;
  transformationId: string;
}) {
  const [checked, setChecked] = useState(relevance === "relevant");
  const [saving, setSaving] = useState(false);
  const href = moduleHref(module, transformationId);

  async function toggle() {
    const next = !checked;
    setChecked(next);
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("module_recommendations")
      .update({ user_override: true, relevance: next ? "relevant" : "not_relevant" })
      .eq("transformation_id", transformationId)
      .eq("module", module);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={checked}
            onChange={toggle}
            disabled={saving}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {MODULE_LABELS[module]}
        </label>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            relevance === "relevant"
              ? "bg-success/15 text-success"
              : relevance === "possible"
                ? "bg-accent/15 text-accent-strong"
                : "bg-surface-2 text-muted"
          }`}
        >
          {RELEVANCE_LABELS[relevance]}
        </span>
      </div>
      <p className="text-sm text-muted">{reason}</p>
      {href ? (
        <Link href={href} className="text-xs font-medium text-accent underline underline-offset-2">
          Ouvrir {MODULE_LABELS[module]} ↗
        </Link>
      ) : (
        <span className="text-xs text-muted">Bientôt disponible</span>
      )}
    </div>
  );
}

export function DiagnosticView({
  result,
  onGenerateScenarios,
  generating,
}: {
  result: DiagnosticResult;
  onGenerateScenarios: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Diagnostic</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Lecture de la situation</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.domains.map((d) => (
            <span
              key={d}
              className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong"
            >
              {DOMAIN_LABELS[d]}
            </span>
          ))}
        </div>
      </div>

      <p className="text-base leading-relaxed text-ink">{result.maturityReading}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Gaps</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {result.gaps.map((g, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p className="font-medium text-ink">{g.name}</p>
                <p className="mt-1 text-muted">{g.reason}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Causes racines</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {result.rootCauses.map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p className="font-medium text-ink">{c.name}</p>
                <p className="mt-1 text-muted">{c.reason}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Priorités (pondérées)</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {result.priorities.map((p, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{p.name}</p>
                  <span className="text-xs font-semibold text-accent">{p.weight}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${p.weight}%` }} />
                </div>
                <p className="mt-1.5 text-muted">{p.reason}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Risques</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {result.risks.map((r, i) => (
              <li key={i} className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
                <p className="font-medium text-ink">{r.name}</p>
                <p className="mt-1 text-muted">{r.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Critères de décision retenus
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.decisionCriteria.map((c, i) => (
            <span
              key={i}
              className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-ink"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-strong">
          Recommandation de démarrage
        </h2>
        <p className="mt-2 text-sm text-ink">{result.startingRecommendation}</p>
      </div>

      <div>
        <Eyebrow>Modules recommandés pour cette transformation</Eyebrow>
        <p className="mt-2 text-xs text-muted">
          Pré-coché selon l&apos;analyse IA — librement modifiable, aucune activation automatique.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(result.moduleRecommendations) as RecommendableModule[]).map((module) => (
            <ModuleRecommendationCard
              key={module}
              module={module}
              relevance={result.moduleRecommendations[module].relevance}
              reason={result.moduleRecommendations[module].reason}
              transformationId={result.transformationId}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerateScenarios}
        disabled={generating}
        className="self-start rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating ? "Génération des scénarios..." : "Générer les 3 scénarios stratégiques"}
      </button>
    </div>
  );
}
