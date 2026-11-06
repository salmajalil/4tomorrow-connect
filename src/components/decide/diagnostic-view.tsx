"use client";

import { Icon } from "@/components/icons";
import { useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { createClient } from "@/lib/supabase/client";
import { DOMAIN_LABELS, DOMAIN_ICONS, type Domain } from "@/lib/decide";
import type { CapabilityGapResult } from "@/lib/decide-diagnostic-calc";
import { rankCapabilityGaps } from "@/lib/decide-diagnostic-calc";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ModuleRelevance, RecommendableModule } from "@/types/database";

export interface DiagnosticResult {
  transformationId: string;
  domains: Domain[];
  maturityReading: string;
  maturityHighlights: string[];
  gaps: { name: string; reason: string }[];
  rootCauses: { name: string; reason: string }[];
  decisionCriteria: string[];
  priorities: { name: string; reason: string; weight: number }[];
  risks: { name: string; reason: string }[];
  startingRecommendation: string;
  startingActions: string[];
  moduleRecommendations: Record<RecommendableModule, { relevance: ModuleRelevance; reason: string }>;
  // D01 — computed server-side (src/lib/decide-diagnostic-calc.ts), never
  // by the AI. May be empty for a transformation created before this existed,
  // or when the user left the capability assessment at its untouched default.
  capabilityGaps: CapabilityGapResult[];
}

function moduleHref(module: RecommendableModule, transformationId: string): string | null {
  if (module === "connect") return "/connect";
  if (module === "learn") return `/learn?transformationId=${transformationId}`;
  if (module === "deliver") return `/deliver?transformationId=${transformationId}`;
  return null;
}

function ModuleRecommendationCard({
  module,
  relevance,
  reason,
  transformationId,
  t,
}: {
  module: RecommendableModule;
  relevance: ModuleRelevance;
  reason: string;
  transformationId: string;
  t: Dictionary;
}) {
  const [checked, setChecked] = useState(relevance === "relevant");
  const [saving, setSaving] = useState(false);
  const href = moduleHref(module, transformationId);
  const moduleLabel = t.nav[module];
  const relevanceLabels: Record<ModuleRelevance, string> = {
    relevant: t.decide.diagnostic.relevanceRelevant,
    possible: t.decide.diagnostic.relevancePossible,
    not_relevant: t.decide.diagnostic.relevanceNotRelevant,
  };

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
          {moduleLabel}
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
          {relevanceLabels[relevance]}
        </span>
      </div>
      <p className="text-sm text-muted">{reason}</p>
      {href ? (
        <Link href={href} className="text-xs font-medium text-accent underline underline-offset-2">
          {t.decide.diagnostic.open} {moduleLabel} ↗
        </Link>
      ) : (
        <span className="text-xs text-muted">{t.decide.diagnostic.comingSoon}</span>
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
  const { t } = useLanguage();
  const diagnostic = t.decide.diagnostic;
  const [showDetails, setShowDetails] = useState(false);
  const [showMaturityFull, setShowMaturityFull] = useState(false);
  const [showRecommendationFull, setShowRecommendationFull] = useState(false);
  const topPriority = [...result.priorities].sort((a, b) => b.weight - a.weight)[0];
  const topRisk = result.risks[0];
  // D01's own headline figure — computed, not generated: the count of
  // capabilities with a real gap (gap > 0) and the single highest-priority
  // one, straight from decide-diagnostic-calc.ts's output. Falls back to the
  // AI's top weighted priority when no capability assessment was filled in
  // (capabilityGaps is empty for transformations created before D01, or when
  // the intake's capability sliders were left untouched).
  const rankedCapabilities = rankCapabilityGaps(result.capabilityGaps);
  const gapsToClose = rankedCapabilities.filter((c) => c.gap > 0);
  const topCapability = gapsToClose[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>{diagnostic.eyebrow}</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">{diagnostic.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.domains.map((d) => (
            <span
              key={d}
              className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong"
            >
              <Icon name={DOMAIN_ICONS[d]} className="inline h-3.5 w-3.5 align-[-2px]" /> {DOMAIN_LABELS[d]}
            </span>
          ))}
        </div>
        {topCapability ? (
          <p className="mt-4 font-display text-2xl text-ink">
            <span className="text-accent">{gapsToClose.length}</span> {diagnostic.headlineGapsSuffix}{" "}
            <span className="text-muted">
              — {diagnostic.headlineTopCapability} {DOMAIN_LABELS[topCapability.domain]}
            </span>
          </p>
        ) : topPriority ? (
          <p className="mt-4 font-display text-2xl text-ink">
            {diagnostic.headlineTopPriority} <span className="text-accent">{topPriority.name}</span>
          </p>
        ) : null}
      </div>

      {result.maturityHighlights.length > 0 ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {result.maturityHighlights.map((h, i) => (
              <li key={i} className="flex items-baseline gap-2.5 text-base text-ink">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {h}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setShowMaturityFull((v) => !v)}
            className="self-start text-xs font-medium text-muted underline underline-offset-2 hover:text-accent"
          >
            {showMaturityFull ? diagnostic.hideFullText : diagnostic.readFullText}
          </button>
          {showMaturityFull && <p className="text-sm leading-relaxed text-muted">{result.maturityReading}</p>}
        </div>
      ) : (
        <p className="text-base leading-relaxed text-ink">{result.maturityReading}</p>
      )}

      {/* Key messages — always visible. The exhaustive breakdown (all gaps,
          root causes, priorities, risks, decision criteria) sits behind the
          "show details" toggle below, so the page opens on what matters
          instead of a wall of cards. */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-strong">
          {diagnostic.startingRecommendation}
        </h2>
        {result.startingActions.length > 0 ? (
          <>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {result.startingActions.map((a, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm text-ink">
                  <span className="font-mono text-xs text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
                  {a}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowRecommendationFull((v) => !v)}
              className="mt-2.5 text-xs font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
            >
              {showRecommendationFull ? diagnostic.hideFullText : diagnostic.readFullText}
            </button>
            {showRecommendationFull && (
              <p className="mt-2 text-sm text-ink/90">{result.startingRecommendation}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink">{result.startingRecommendation}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topPriority && (
          <div className="rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{diagnostic.topPriority}</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <p className="font-medium text-ink">{topPriority.name}</p>
              <span className="text-xs font-semibold text-accent">{topPriority.weight}%</span>
            </div>
            <p className="mt-1 text-muted">{topPriority.reason}</p>
          </div>
        )}
        {topRisk && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{diagnostic.topRisk}</p>
            <p className="mt-1.5 font-medium text-ink">{topRisk.name}</p>
            <p className="mt-1 text-muted">{topRisk.reason}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-accent hover:text-accent-strong"
      >
        <span aria-hidden className={`transition-transform ${showDetails ? "rotate-90" : ""}`}>
          ›
        </span>
        {showDetails ? diagnostic.hideFullDiagnostic : diagnostic.showFullDiagnostic}
      </button>

      {showDetails && (
        <div className="flex flex-col gap-8">
          <p className="-mt-4 text-xs text-muted">{diagnostic.fullDiagnosticHint}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.gaps}</h2>
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.rootCauses}</h2>
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.priorities}</h2>
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.risks}</h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.capabilitiesTitle}</h2>
            <p className="mt-1 text-xs text-muted">{diagnostic.capabilitiesHint}</p>
            {result.capabilityGaps.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{diagnostic.capabilitiesEmpty}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {rankCapabilityGaps(result.capabilityGaps).map((c) => (
                  <li key={c.domain} className="rounded-lg border border-border bg-surface p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">{DOMAIN_LABELS[c.domain]}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          c.status === "vérifié" ? "bg-success/15 text-success" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {c.status === "vérifié" ? diagnostic.capabilityStatusVerified : diagnostic.capabilityStatusUnverified}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {diagnostic.capabilityObserved} {c.observed}/5 · {diagnostic.capabilityTarget} {c.target}/5 ·{" "}
                      {diagnostic.capabilityImportance} {c.importance}/5
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="text-ink">
                        {diagnostic.capabilityGap} : <span className="font-semibold text-accent">{c.gap}</span>
                      </span>
                      <span className="text-ink">
                        {diagnostic.capabilityPriority} : <span className="font-semibold text-accent">{c.priority}</span>
                      </span>
                    </div>
                    {c.proofNote && <p className="mt-1.5 text-muted">{c.proofNote}</p>}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold uppercase tracking-wide text-muted">
                {diagnostic.howCalculatedTitle}
              </summary>
              <p className="mt-2 text-muted">{diagnostic.capabilitiesHint}</p>
            </details>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{diagnostic.decisionCriteria}</h2>
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
        </div>
      )}

      <div>
        <Eyebrow>{diagnostic.recommendedModules}</Eyebrow>
        <p className="mt-2 text-xs text-muted">{diagnostic.recommendedModulesHint}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(result.moduleRecommendations) as RecommendableModule[]).map((module) => (
            <ModuleRecommendationCard
              key={module}
              module={module}
              relevance={result.moduleRecommendations[module].relevance}
              reason={result.moduleRecommendations[module].reason}
              transformationId={result.transformationId}
              t={t}
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
        {generating ? diagnostic.generating : diagnostic.generateScenarios}
      </button>
    </div>
  );
}
