"use client";

import { useLanguage } from "@/components/language-provider";
import type { RankedScenario } from "@/lib/decide-scenario-calc";

// D04 — Matrice de décision, vue principale de comparaison : lignes =
// critères, colonnes = scénarios, cellules = la note brute 0-10 donnée par
// l'analyse (jamais modifiée ici). La dernière ligne affiche le score
// pondéré et le rang tels que renvoyés par rankScenarios
// (src/lib/decide-scenario-calc.ts) : ce composant n'effectue aucun calcul,
// il affiche. Chaque ligne porte le curseur de poids de son critère ;
// bouger un curseur remonte au parent (decide-flow.tsx), qui rééquilibre
// via rebalanceWeights puis reclasse via rankScenarios — la matrice se met
// à jour en direct.
//
// Par défaut on montre le moteur (paramètres réglables), pas la formule ;
// la mécanique reste entièrement consultable dans le bloc repliable
// « Comment c'est calculé ».
export function ScenarioComparator({
  axes,
  axisLabel,
  scenarios,
  recommendedIndex,
  weights,
  ranked,
  weightError,
  sensitivityStable,
  onWeightChange,
  title,
  hint,
}: {
  axes: string[];
  axisLabel: (axis: string) => string;
  scenarios: { trajectoryId: string; label: string; scores: Record<string, number | undefined>; veto: boolean }[];
  recommendedIndex: number;
  weights: Record<string, number>;
  // Result of rankScenarios for the current weights; empty while the
  // weights are invalid (the weighted row then shows a dash, never a guess).
  ranked: RankedScenario[];
  weightError: string | null;
  sensitivityStable: boolean;
  onWeightChange: (axis: string, value: number) => void;
  title: string;
  hint: string;
}) {
  const { t, language } = useLanguage();
  const s = t.decide.scenarios;
  if (axes.length === 0 || scenarios.length === 0) return null;

  const scoreFormat = new Intl.NumberFormat(language === "en" ? "en-GB" : "fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const rankOf = (trajectoryId: string) => {
    const i = ranked.findIndex((r) => r.trajectoryId === trajectoryId);
    return i >= 0 ? { position: i + 1, score: ranked[i].weightedScore } : null;
  };
  const colClass = (i: number) => (i === recommendedIndex ? "bg-accent/10" : "");

  return (
    <section className="border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <p className="flex items-center gap-2 border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-strong">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          {s.engineBadge}
        </p>
      </div>
      <p className="mt-3 text-xs text-muted">{s.engineHint}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{s.matrixTitle}</caption>
          <thead>
            <tr className="border-b border-border-strong text-left align-bottom">
              <th scope="col" className="py-2 pr-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                {s.matrixCriterion}
              </th>
              <th scope="col" className="w-40 py-2 pr-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                {s.matrixWeight}
              </th>
              {scenarios.map((sc, i) => (
                <th
                  key={sc.trajectoryId}
                  scope="col"
                  className={`px-2 py-2 text-center text-xs font-semibold ${colClass(i)} ${
                    i === recommendedIndex ? "text-accent-strong" : "text-ink"
                  }`}
                >
                  <span className="block leading-snug">{sc.label}</span>
                  {i === recommendedIndex && (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em]">{s.recommended}</span>
                  )}
                  {sc.veto && (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-danger">{s.matrixVetoed}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.map((axis) => {
              const w = weights[axis] ?? 0;
              return (
                <tr key={axis} className="border-b border-border">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal text-body">
                    {axisLabel(axis)}
                  </th>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(w)}
                        onChange={(e) => onWeightChange(axis, Number(e.target.value))}
                        aria-label={s.matrixWeightAria.replace("{axis}", axisLabel(axis))}
                        aria-valuetext={`${Math.round(w)} %`}
                        className="h-1.5 w-full min-w-16 cursor-pointer accent-[var(--accent)]"
                      />
                      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink">{Math.round(w)} %</span>
                    </span>
                  </td>
                  {scenarios.map((sc, i) => {
                    const v = sc.scores[axis];
                    return (
                      <td
                        key={sc.trajectoryId}
                        className={`px-2 py-2.5 text-center font-mono text-sm tabular-nums ${colClass(i)} ${
                          sc.veto ? "text-muted line-through" : i === recommendedIndex ? "text-accent-strong" : "text-ink"
                        }`}
                      >
                        {typeof v === "number" ? v : s.matrixUnavailable}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <th scope="row" colSpan={2} className="py-3 pr-3 text-left text-sm font-semibold text-ink">
                {s.matrixWeightedScore}
                <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted">· {s.matrixRank}</span>
              </th>
              {scenarios.map((sc, i) => {
                const r = rankOf(sc.trajectoryId);
                return (
                  <td key={sc.trajectoryId} className={`px-2 py-3 text-center ${colClass(i)}`}>
                    <span
                      className={`block font-display text-xl tabular-nums ${i === recommendedIndex ? "text-accent-strong" : "text-ink"}`}
                    >
                      {r ? scoreFormat.format(r.score) : s.matrixUnavailable}
                    </span>
                    {r && <span className="block font-mono text-[11px] text-muted">#{r.position}</span>}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {weightError && <p className="mt-3 text-xs text-danger">{weightError}</p>}
      {!sensitivityStable && (
        <div className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2">
          <p className="text-sm font-medium text-ink">{s.sensitivityTitle}</p>
          <p className="mt-1 text-xs text-muted">{s.sensitivityHint}</p>
        </div>
      )}

      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-accent-strong">{s.howCalculatedTitle}</summary>
        <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
          <p>{s.howCalculatedScores}</p>
          <p>{s.howCalculatedWeighted}</p>
          <p>{s.howCalculatedVeto}</p>
          <p>{s.howCalculatedSensitivity}</p>
        </div>
      </details>
    </section>
  );
}
