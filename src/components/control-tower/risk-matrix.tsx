import { Fragment } from "react";
import { computeRiskSeverity, riskZone, type RiskZone } from "@/lib/risk-scoring";
import type { Dictionary } from "@/lib/i18n/dictionary";

type MatrixRisk = {
  id: string;
  name: string;
  probability: number | null;
  impact: number | null;
};

const ZONE_CLASS: Record<RiskZone, string> = {
  faible: "bg-success/10",
  modéré: "bg-accent/10",
  élevé: "bg-danger/15",
  critique: "bg-danger/30",
};

const DOT_CLASS: Record<RiskZone, string> = {
  faible: "bg-success",
  modéré: "bg-accent-strong",
  élevé: "bg-danger",
  critique: "bg-danger",
};

const PROBABILITY_ROWS = [5, 4, 3, 2, 1]; // highest at top, reads like a chart
const IMPACT_COLS = [1, 2, 3, 4, 5];

// AR — vue graphique de la matrice ISO 31000 (probabilité × impact, 1-25),
// posée au-dessus des cartes de risques éditables : c'est l'étape
// "graphique" du gabarit, avant les "données modifiables" (RiskRow).
// Chaque cellule est teintée selon son palier (src/lib/risk-scoring.ts,
// jamais inventé) ; les risques évalués y sont placés comme des pastilles.
// 6 colonnes (1 pour les numéros de probabilité + 5 pour l'impact) : lisible
// jusqu'à ~340px de large sans défilement horizontal.
export function RiskMatrix({ risks, ct }: { risks: MatrixRisk[]; ct: Dictionary["controlTower"] }) {
  const evaluated = risks.filter((r) => r.probability !== null && r.impact !== null);

  if (evaluated.length === 0) {
    return <p className="border border-dashed border-border bg-surface-2 px-3 py-4 text-center text-xs text-muted">{ct.riskMatrixEmpty}</p>;
  }

  const byCell = new Map<string, MatrixRisk[]>();
  for (const r of evaluated) {
    const key = `${r.probability}-${r.impact}`;
    byCell.set(key, [...(byCell.get(key) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[9.5px] uppercase tracking-wide text-muted">
        {ct.probabilityLabel} ↕ · {ct.impactLabel} ↔
      </p>
      <div className="grid grid-cols-[20px_repeat(5,1fr)] gap-1">
        {PROBABILITY_ROWS.map((p) => (
          <Fragment key={p}>
            <span className="flex items-center justify-center font-mono text-[10px] text-muted">{p}</span>
            {IMPACT_COLS.map((i) => {
              const severity = computeRiskSeverity({ probability: p, impact: i }).severity;
              const zone = riskZone(severity);
              const cellRisks = byCell.get(`${p}-${i}`) ?? [];
              const names = cellRisks.map((r) => r.name).join(", ");
              return (
                <div
                  key={`${p}-${i}`}
                  title={names || undefined}
                  className={`flex aspect-square min-w-0 items-center justify-center ${zone ? ZONE_CLASS[zone] : ""}`}
                >
                  {cellRisks.length > 0 && (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-accent-ink ${zone ? DOT_CLASS[zone] : "bg-ink"}`}
                    >
                      {cellRisks.length}
                    </span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
        <span />
        {IMPACT_COLS.map((i) => (
          <span key={`i-${i}`} className="text-center font-mono text-[10px] text-muted">
            {i}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[9.5px] uppercase tracking-wide text-muted">
        {(["faible", "modéré", "élevé", "critique"] as RiskZone[]).map((z) => (
          <span key={z} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT_CLASS[z]}`} />
            {z === "faible" ? ct.riskZoneLow : z === "modéré" ? ct.riskZoneMedium : z === "élevé" ? ct.riskZoneHigh : ct.riskZoneCritical}
          </span>
        ))}
      </div>
    </div>
  );
}
