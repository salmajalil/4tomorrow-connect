// L06 — Réalisation des bénéfices : calcul déterministe, côté serveur.
// Règles (brief L06) :
//   bénéfice attendu (issu de D05, ou saisi si D05 est inactif) comparé à
//     l'observé, à périmètre constant ;
//   deux gains sur le même périmètre ne s'additionnent pas.
//
// "expected_annual" (table benefit_expectations) est le point d'intégration
// avec D05 : saisi à la main ici tant que D05 n'existe pas (construit en
// parallèle), ou écrit par D05 lui-même avec source="business_case" une
// fois ce module disponible — cette fonction ne sait rien de D05, elle
// prend juste un nombre ou null.
export interface BenefitItemInput {
  label: string;
  perimeter: string;
  value: number;
}

export interface BenefitObservationInput {
  month: string; // "YYYY-MM"
  value: number;
}

export interface BenefitItemsTotalResult {
  totalByPerimeter: { perimeter: string; value: number; itemCount: number }[];
  itemsTotal: number; // somme des MAX par périmètre — jamais une somme brute
  overlaps: string[]; // périmètres où plusieurs items existaient (fusionnés par max, pas additionnés)
}

/**
 * Deux gains sur le même périmètre ne s'additionnent pas : on groupe par
 * périmètre et on garde le maximum de chaque groupe, jamais la somme.
 */
export function computeItemsTotal(items: BenefitItemInput[]): BenefitItemsTotalResult {
  const byPerimeter = new Map<string, { value: number; itemCount: number }>();
  for (const item of items) {
    const existing = byPerimeter.get(item.perimeter);
    if (!existing) {
      byPerimeter.set(item.perimeter, { value: item.value, itemCount: 1 });
    } else {
      byPerimeter.set(item.perimeter, { value: Math.max(existing.value, item.value), itemCount: existing.itemCount + 1 });
    }
  }
  const totalByPerimeter = [...byPerimeter.entries()]
    .map(([perimeter, { value, itemCount }]) => ({ perimeter, value, itemCount }))
    .sort((a, b) => a.perimeter.localeCompare(b.perimeter));
  return {
    totalByPerimeter,
    itemsTotal: totalByPerimeter.reduce((sum, p) => sum + p.value, 0),
    overlaps: totalByPerimeter.filter((p) => p.itemCount > 1).map((p) => p.perimeter),
  };
}

/** Moyenne glissante des 12 derniers mois (ou moins si l'historique est plus court) × 12. */
export function computeObservedAnnual(observations: BenefitObservationInput[]): { observedAnnual: number; monthsUsed: number } | null {
  if (observations.length === 0) return null;
  const sorted = [...observations].sort((a, b) => a.month.localeCompare(b.month));
  const last12 = sorted.slice(-12);
  const avg = last12.reduce((sum, o) => sum + o.value, 0) / last12.length;
  return { observedAnnual: Math.round(avg * 12 * 100) / 100, monthsUsed: last12.length };
}

export interface BenefitComparisonResult {
  expectedAnnual: number | null;
  observedAnnual: number | null;
  gap: number | null; // observedAnnual - expectedAnnual
  percentOfExpected: number | null; // null si expectedAnnual absent ou 0
}

/** Compare attendu vs observé, à périmètre constant (observedAnnual vient déjà de computeObservedAnnual). */
export function compareBenefits(expectedAnnual: number | null, observedAnnual: number | null): BenefitComparisonResult {
  const gap = expectedAnnual !== null && observedAnnual !== null ? Math.round((observedAnnual - expectedAnnual) * 100) / 100 : null;
  const percentOfExpected =
    expectedAnnual !== null && expectedAnnual !== 0 && observedAnnual !== null
      ? Math.round((observedAnnual / expectedAnnual) * 10000) / 100
      : null;
  return { expectedAnnual, observedAnnual, gap, percentOfExpected };
}
