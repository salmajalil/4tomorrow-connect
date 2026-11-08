// D04 — Matrice de décision : pondération, veto et sensibilité, calculés,
// jamais générés par l'IA. L'IA continue de produire `scores` (0-10 par
// critère, voir buildScenarioSystemPrompt dans decide.ts) — c'est sa lecture
// honnête de chaque scénario sur chaque critère, jamais remise en cause ici.
// Ce module calcule, à partir de ces scores et des poids choisis par
// l'utilisateur : le score pondéré, le classement (une option sous veto ne
// finit jamais première), et l'alerte de sensibilité (±10 points par poids).
//
// Règles (brief D04) :
//   poids = 100 % obligatoire ;
//   une option sous veto ne finit jamais première ;
//   sensibilité à ±10 points par poids, alerte si le classement bascule.

export interface ScenarioScoreInput {
  trajectoryId: string;
  scores: Record<string, number>; // 0-10 par axe, généré par l'IA (non modifié ici)
  veto: boolean;
}

export interface RankedScenario {
  trajectoryId: string;
  weightedScore: number;
  veto: boolean;
}

const WEIGHT_SUM_TOLERANCE = 0.001; // tolère l'arrondi flottant, pas un vrai écart

/** La somme des poids doit faire 100 % ; chaque poids doit être entre 0 et 100. */
export function validateWeights(weights: Record<string, number>): string[] {
  const errors: string[] = [];
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    errors.push("Au moins un critère pondéré est nécessaire.");
    return errors;
  }
  for (const [axis, weight] of entries) {
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      errors.push(`${axis} : le poids doit être compris entre 0 et 100.`);
    }
  }
  if (errors.length > 0) return errors;
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  if (Math.abs(sum - 100) > WEIGHT_SUM_TOLERANCE) {
    errors.push(`La somme des poids doit faire 100 % (actuellement ${Math.round(sum * 10) / 10} %).`);
  }
  return errors;
}

/** Score pondéré d'un scénario : somme(poids/100 × note par critère), sur une échelle 0-10. */
export function weightedScore(scores: Record<string, number>, weights: Record<string, number>): number {
  return Object.entries(weights).reduce((total, [axis, weight]) => total + (weight / 100) * (scores[axis] ?? 0), 0);
}

/**
 * Classe les scénarios par score pondéré décroissant — mais un scénario sous
 * veto ne finit jamais premier : il passe toujours après tous les scénarios
 * non-veto, quel que soit son score. Déterministe (aucun hasard) : à égalité
 * de score, l'ordre est stable par trajectoryId.
 */
export function rankScenarios(
  scenarios: ScenarioScoreInput[],
  weights: Record<string, number>
): RankedScenario[] {
  const ranked = scenarios.map((s) => ({
    trajectoryId: s.trajectoryId,
    weightedScore: weightedScore(s.scores, weights),
    veto: s.veto,
  }));
  return ranked.sort((a, b) => {
    if (a.veto !== b.veto) return a.veto ? 1 : -1; // veto toujours après non-veto
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    return a.trajectoryId.localeCompare(b.trajectoryId);
  });
}

/** Le gagnant : le premier scénario non-veto du classement, ou null si tous sont sous veto. */
export function pickWinner(ranked: RankedScenario[]): RankedScenario | null {
  return ranked.find((r) => !r.veto) ?? null;
}

export interface SensitivityFlip {
  axis: string;
  delta: 10 | -10;
  newWinnerId: string | null;
}

export interface SensitivityResult {
  stable: boolean;
  flips: SensitivityFlip[];
}

/**
 * Pour chaque critère, simule un poids ±10 points (redistribué
 * proportionnellement sur les autres critères, qui gardent leur poids
 * relatif entre eux), recalcule le classement, et signale si le gagnant
 * change. "stable: true" = le classement ne bascule jamais sur ±10 points,
 * quel que soit le critère.
 */
export function computeSensitivity(
  scenarios: ScenarioScoreInput[],
  weights: Record<string, number>
): SensitivityResult {
  const baseline = pickWinner(rankScenarios(scenarios, weights));
  const flips: SensitivityFlip[] = [];
  const axes = Object.keys(weights);

  for (const axis of axes) {
    for (const delta of [-10, 10] as const) {
      const current = weights[axis];
      const next = Math.min(100, Math.max(0, current + delta));
      const realDelta = next - current;
      if (realDelta === 0) continue;

      const others = axes.filter((a) => a !== axis);
      const otherSum = others.reduce((total, a) => total + weights[a], 0);
      if (otherSum === 0) continue; // rien à redistribuer

      const adjusted: Record<string, number> = { ...weights, [axis]: next };
      for (const other of others) {
        adjusted[other] = weights[other] - realDelta * (weights[other] / otherSum);
      }

      const candidateWinner = pickWinner(rankScenarios(scenarios, adjusted));
      const candidateId = candidateWinner?.trajectoryId ?? null;
      const baselineId = baseline?.trajectoryId ?? null;
      if (candidateId !== baselineId) {
        flips.push({ axis, delta, newWinnerId: candidateId });
      }
    }
  }

  return { stable: flips.length === 0, flips };
}

/** Vue radar en option (brief D04) : illisible en dessous de 3 axes (pas de forme) ou au-delà de 6 (axes trop serrés). */
export function canShowRadar(axesCount: number): boolean {
  return axesCount >= 3 && axesCount <= 6;
}

/** Répartit 100% également entre les axes donnés — le point de départ par défaut avant tout ajustement manuel. */
export function equalWeights(axes: string[]): Record<string, number> {
  if (axes.length === 0) return {};
  const base = Math.floor(100 / axes.length);
  const remainder = 100 - base * axes.length;
  const weights: Record<string, number> = {};
  axes.forEach((axis, i) => {
    weights[axis] = base + (i < remainder ? 1 : 0);
  });
  return weights;
}

/**
 * Curseur de pondération (matrice D04) : fixe le poids d'un critère et
 * redistribue le reste (100 − nouveau poids) sur les autres critères au
 * prorata de leurs poids actuels — la même règle que l'analyse de
 * sensibilité ci-dessus, mais en entiers (la colonne
 * decision_criteria_weights.weight est un integer). Arrondi par plus fort
 * reste : la somme fait toujours exactement 100. Si tous les autres poids
 * sont à 0, le reste est réparti également entre eux. Un critère inconnu ne
 * change rien.
 */
export function rebalanceWeights(
  weights: Record<string, number>,
  axis: string,
  value: number
): Record<string, number> {
  if (!(axis in weights)) return { ...weights };
  const axes = Object.keys(weights);
  const others = axes.filter((a) => a !== axis);
  if (others.length === 0) return { [axis]: 100 };

  const next = Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  const remaining = 100 - next;
  const otherSum = others.reduce((total, a) => total + Math.max(0, weights[a] ?? 0), 0);
  const shares = others.map((a) => ({
    axis: a,
    exact: otherSum > 0 ? (remaining * Math.max(0, weights[a] ?? 0)) / otherSum : remaining / others.length,
  }));

  const result: Record<string, number> = { [axis]: next };
  for (const s of shares) result[s.axis] = Math.floor(s.exact);
  let leftover = remaining - shares.reduce((total, s) => total + result[s.axis], 0);
  // Plus fort reste d'abord ; à égalité, ordre des critères (déterministe).
  const byRemainder = [...shares].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (const s of byRemainder) {
    if (leftover <= 0) break;
    result[s.axis] += 1;
    leftover -= 1;
  }

  // Conserve l'ordre d'origine des clés (l'affichage suit cet ordre).
  return Object.fromEntries(axes.map((a) => [a, result[a]]));
}
