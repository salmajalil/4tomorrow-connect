// D05 — Business case : calcul déterministe, côté serveur, option désactivée
// par défaut. Aucune valeur ici ne vient de l'IA.
//
// Règles (brief D05) :
//   retour simple non actualisé (payback = investissement / gain net annuel) ;
//   VAN (NPV) calculée uniquement si un taux d'actualisation est fourni —
//     jamais de taux inventé ni de valeur par défaut.
// Pure module, no "server-only" guard: nothing here is a secret, and this
// file is imported directly by its Vitest unit tests (server-only throws
// unconditionally outside a Next.js server-component bundling context).

export interface BusinessCaseInput {
  capex: number; // investissement initial, > 0
  annualGains: number; // gains bruts annuels, >= 0
  annualCosts: number; // coûts récurrents annuels, >= 0
  horizonYears: number; // horizon, entier 1-15
  discountRatePercent: number | null; // taux facultatif, 0-50 ; null = pas de VAN
}

export interface BusinessCaseResult {
  netAnnual: number;
  paybackYears: number | null; // null si le gain net annuel est <= 0 (jamais rentable)
  npv: number | null; // null tant qu'aucun taux n'est fourni
  cumulativeByYear: number[]; // [-capex, ...] jusqu'à horizonYears, longueur horizonYears+1
}

export function validateBusinessCaseInputs(input: BusinessCaseInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.capex) || input.capex <= 0) {
    errors.push("L'investissement initial doit être un montant positif.");
  }
  if (!Number.isFinite(input.annualGains) || input.annualGains < 0) {
    errors.push("Les gains bruts annuels doivent être un montant positif ou nul.");
  }
  if (!Number.isFinite(input.annualCosts) || input.annualCosts < 0) {
    errors.push("Les coûts récurrents annuels doivent être un montant positif ou nul.");
  }
  if (!Number.isInteger(input.horizonYears) || input.horizonYears < 1 || input.horizonYears > 15) {
    errors.push("L'horizon doit être un nombre entier d'années entre 1 et 15.");
  }
  if (
    input.discountRatePercent !== null &&
    (!Number.isFinite(input.discountRatePercent) || input.discountRatePercent < 0 || input.discountRatePercent > 50)
  ) {
    errors.push("Le taux d'actualisation doit être entre 0 et 50 %, ou laissé vide.");
  }
  return errors;
}

/** Fonction pure : mêmes entrées => mêmes sorties, jamais d'appel réseau ni d'IA. */
export function computeBusinessCase(input: BusinessCaseInput): BusinessCaseResult {
  const netAnnual = input.annualGains - input.annualCosts;
  const paybackYears = netAnnual > 0 ? round(input.capex / netAnnual) : null;

  const cumulativeByYear: number[] = [-input.capex];
  for (let year = 1; year <= input.horizonYears; year++) {
    cumulativeByYear.push(round(cumulativeByYear[year - 1] + netAnnual));
  }

  // VAN jamais calculée sans taux explicitement saisi — pas de défaut inventé.
  const npv =
    input.discountRatePercent === null
      ? null
      : round(
          -input.capex +
            sumDiscountedCashflows(netAnnual, input.horizonYears, input.discountRatePercent)
        );

  return { netAnnual: round(netAnnual), paybackYears, npv, cumulativeByYear };
}

function sumDiscountedCashflows(netAnnual: number, years: number, ratePercent: number): number {
  const rate = ratePercent / 100;
  let total = 0;
  for (let year = 1; year <= years; year++) {
    total += netAnnual / Math.pow(1 + rate, year);
  }
  return total;
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}
