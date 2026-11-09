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

// ---------------------------------------------------------------------------
// Trajectoire attendue vs réalisée (benchmark Cascade). Interpolation
// linéaire déterministe entre le début du projet et la date cible : à X % du
// temps écoulé, la trajectoire attendue vaut baseline + X % de l'écart entre
// la baseline et la cible. Sans date de début, sans date cible ou sans
// bénéfice attendu, rien n'est calculé (null) — jamais une date devinée.
// ---------------------------------------------------------------------------

export interface TrajectoryInput {
  startDate: string | null; // "YYYY-MM-DD" — début du projet ou première observation
  targetDate: string | null; // "YYYY-MM-DD" — date cible
  today: string; // "YYYY-MM-DD"
  baseline: number; // bénéfice au démarrage (0 pour un gain)
  target: number | null; // bénéfice annuel attendu à la date cible
}

export interface TrajectoryResult {
  elapsedRatio: number; // part du temps écoulé, bornée à [0, 1]
  expectedToDate: number; // trajectoire attendue à la date du jour
}

function isoDayMs(iso: string | null): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return null;
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

/** Trajectoire attendue à date ; null si la date de début, la date cible ou la cible manque (ou cible ≤ début). */
export function computeExpectedTrajectory(input: TrajectoryInput): TrajectoryResult | null {
  const start = isoDayMs(input.startDate);
  const end = isoDayMs(input.targetDate);
  const now = isoDayMs(input.today);
  if (start === null || end === null || now === null || input.target === null || end <= start) return null;
  const elapsedRatio = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const expectedToDate = Math.round((input.baseline + elapsedRatio * (input.target - input.baseline)) * 100) / 100;
  return { elapsedRatio: Math.round(elapsedRatio * 10000) / 10000, expectedToDate };
}

export interface TrajectoryComparison {
  realized: number;
  expectedToDate: number;
  gap: number; // realized - expectedToDate
  gapPercent: number | null; // écart rapporté à la trajectoire attendue ; null si attendu = 0
  status: "ahead" | "on_track" | "behind";
}

/** Réalisé vs trajectoire attendue à date. "on_track" si |écart| ≤ tolérance (défaut 5 %) de l'attendu. */
export function compareToTrajectory(realized: number, expectedToDate: number, tolerancePercent = 5): TrajectoryComparison {
  const gap = Math.round((realized - expectedToDate) * 100) / 100;
  const gapPercent = expectedToDate !== 0 ? Math.round((gap / Math.abs(expectedToDate)) * 10000) / 100 : null;
  const status =
    gapPercent === null
      ? gap > 0
        ? "ahead"
        : gap < 0
          ? "behind"
          : "on_track"
      : Math.abs(gapPercent) <= tolerancePercent
        ? "on_track"
        : gapPercent > 0
          ? "ahead"
          : "behind";
  return { realized, expectedToDate, gap, gapPercent, status };
}

/**
 * Fenêtre de la trajectoire à partir des données déjà saisies : début =
 * démarrage réel de la première phase (sinon son début prévu, sinon la
 * première observation mensuelle) ; cible = fin prévue la plus tardive de la
 * roadmap. null là où l'information n'existe pas.
 */
export function resolveTrajectoryWindow(
  phases: { start_date: string; end_date: string; actual_start_date: string | null; order_index: number }[],
  observations: BenefitObservationInput[]
): { startDate: string | null; targetDate: string | null } {
  const sorted = [...phases].sort((a, b) => a.order_index - b.order_index);
  const firstObs = [...observations].sort((a, b) => a.month.localeCompare(b.month))[0];
  const startDate =
    sorted[0]?.actual_start_date ?? sorted[0]?.start_date ?? (firstObs ? `${firstObs.month}-01` : null);
  const targetDate = sorted.reduce<string | null>((max, p) => (!max || p.end_date > max ? p.end_date : max), null);
  return { startDate, targetDate };
}
