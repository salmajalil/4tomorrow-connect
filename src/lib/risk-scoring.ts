// AR (transverse) — sévérité d'un risque : calcul déterministe, côté serveur.
// probability/impact/owner/treatment sont saisis par l'utilisateur (jamais
// par l'IA, qui ne fait que suggérer le nom/la raison d'un risque) — tant
// que l'un des deux chiffres manque, le risque reste "non évalué", jamais
// une sévérité inventée.
export type RiskSeverityStatus = "non évalué" | "évalué";

export interface RiskScoreInput {
  probability: number | null;
  impact: number | null;
}

export interface RiskScoreResult {
  status: RiskSeverityStatus;
  severity: number | null; // probability * impact, 1-25 ; null si non évalué
}

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * Sévérité = probabilité × impact (1-25). Fonction pure : jamais d'IA,
 * jamais de réseau. Un risque sans les deux valeurs reste "non évalué".
 */
export function computeRiskSeverity(input: RiskScoreInput): RiskScoreResult {
  const { probability, impact } = input;
  if (probability === null || impact === null || !inRange(probability) || !inRange(impact)) {
    return { status: "non évalué", severity: null };
  }
  return { status: "évalué", severity: probability * impact };
}

export type RiskZone = "faible" | "modéré" | "élevé" | "critique";

/**
 * Palier ISO 31000 à partir de la sévérité (1-25) : faible (1-4), modéré
 * (5-9), élevé (10-14), critique (15-25). Pure, jamais d'IA — la sévérité
 * elle-même vient toujours de computeRiskSeverity, jamais inventée ici.
 */
export function riskZone(severity: number | null): RiskZone | null {
  if (severity === null) return null;
  if (severity <= 4) return "faible";
  if (severity <= 9) return "modéré";
  if (severity <= 14) return "élevé";
  return "critique";
}

/** Trie les risques par sévérité décroissante ; les non évalués passent en dernier, puis par nom. */
export function rankRisksBySeverity<T extends { name: string; probability: number | null; impact: number | null }>(
  risks: T[]
): (T & RiskScoreResult)[] {
  return risks
    .map((r) => ({ ...r, ...computeRiskSeverity({ probability: r.probability, impact: r.impact }) }))
    .sort((a, b) => {
      if (a.severity === null && b.severity === null) return a.name.localeCompare(b.name);
      if (a.severity === null) return 1;
      if (b.severity === null) return -1;
      return b.severity - a.severity || a.name.localeCompare(b.name);
    });
}
