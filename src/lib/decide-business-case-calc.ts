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

export type BusinessCaseField = "capex" | "annualGains" | "annualCosts" | "horizonYears" | "discountRatePercent";

/** Champs dont la valeur est hors des bornes du brief D05 (liste vide = valide). */
export function invalidBusinessCaseFields(input: BusinessCaseInput): BusinessCaseField[] {
  const fields: BusinessCaseField[] = [];
  if (!Number.isFinite(input.capex) || input.capex <= 0) fields.push("capex");
  if (!Number.isFinite(input.annualGains) || input.annualGains < 0) fields.push("annualGains");
  if (!Number.isFinite(input.annualCosts) || input.annualCosts < 0) fields.push("annualCosts");
  if (!Number.isInteger(input.horizonYears) || input.horizonYears < 1 || input.horizonYears > 15) {
    fields.push("horizonYears");
  }
  if (
    input.discountRatePercent !== null &&
    (!Number.isFinite(input.discountRatePercent) || input.discountRatePercent < 0 || input.discountRatePercent > 50)
  ) {
    fields.push("discountRatePercent");
  }
  return fields;
}

const FIELD_ERRORS: Record<BusinessCaseField, string> = {
  capex: "L'investissement initial doit être un montant positif.",
  annualGains: "Les gains bruts annuels doivent être un montant positif ou nul.",
  annualCosts: "Les coûts récurrents annuels doivent être un montant positif ou nul.",
  horizonYears: "L'horizon doit être un nombre entier d'années entre 1 et 15.",
  discountRatePercent: "Le taux d'actualisation doit être entre 0 et 50 %, ou laissé vide.",
};

export function validateBusinessCaseInputs(input: BusinessCaseInput): string[] {
  return invalidBusinessCaseFields(input).map((field) => FIELD_ERRORS[field]);
}

// ---------------------------------------------------------------------------
// Gabarit — lecture du formulaire (valeurs brutes des champs, en texte).
// Distingue « champ non rempli » (chaîne vide => incomplet) de « zéro saisi »
// (« 0 » => valeur réelle, validée comme les autres) : jamais de
// Number("") === 0 silencieux.
// ---------------------------------------------------------------------------
export interface BusinessCaseFormValues {
  capex: string;
  annualGains: string;
  annualCosts: string;
  horizonYears: string;
  discountRatePercent: string; // facultatif : vide = pas de VAN
}

export type BusinessCaseFormStatus = "vide" | "incomplet" | "calcul_impossible" | "pret";

export interface BusinessCaseFormReading {
  status: BusinessCaseFormStatus;
  missing: BusinessCaseField[]; // champs obligatoires non remplis
  invalid: BusinessCaseField[]; // champs remplis mais non numériques ou hors bornes
  input: BusinessCaseInput | null; // non null uniquement si status === "pret"
}

const REQUIRED_FIELDS: BusinessCaseField[] = ["capex", "annualGains", "annualCosts", "horizonYears"];

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Fonction pure : lit les champs saisis et dit dans quel état du gabarit est le formulaire. */
export function readBusinessCaseForm(values: BusinessCaseFormValues): BusinessCaseFormReading {
  // L'horizon a une valeur par défaut (3 ans) : il ne compte pas pour décider
  // si l'utilisateur a commencé à saisir quelque chose.
  const userFields: BusinessCaseField[] = ["capex", "annualGains", "annualCosts", "discountRatePercent"];
  if (userFields.every((f) => values[f].trim() === "")) {
    return { status: "vide", missing: [...REQUIRED_FIELDS.filter((f) => values[f].trim() === "")], invalid: [], input: null };
  }

  const missing = REQUIRED_FIELDS.filter((f) => values[f].trim() === "");
  const parsed = {
    capex: parseNumber(values.capex),
    annualGains: parseNumber(values.annualGains),
    annualCosts: parseNumber(values.annualCosts),
    horizonYears: parseNumber(values.horizonYears),
    discountRatePercent: parseNumber(values.discountRatePercent),
  };
  const notNumeric = (Object.keys(parsed) as BusinessCaseField[]).filter((f) => Number.isNaN(parsed[f]));

  if (missing.length > 0) {
    return { status: "incomplet", missing, invalid: notNumeric, input: null };
  }

  const input: BusinessCaseInput = {
    capex: parsed.capex as number,
    annualGains: parsed.annualGains as number,
    annualCosts: parsed.annualCosts as number,
    horizonYears: parsed.horizonYears as number,
    discountRatePercent: parsed.discountRatePercent,
  };
  const invalid = Array.from(new Set([...notNumeric, ...invalidBusinessCaseFields(input)]));
  if (invalid.length > 0) {
    return { status: "calcul_impossible", missing: [], invalid, input: null };
  }
  return { status: "pret", missing: [], invalid: [], input };
}

/** Signature stable des entrées — comparée à celle du résultat affiché pour détecter « à revoir » (même principe que flowInputsSignature). */
export function businessCaseInputsSignature(input: BusinessCaseInput): string {
  return JSON.stringify([
    input.capex,
    input.annualGains,
    input.annualCosts,
    input.horizonYears,
    input.discountRatePercent,
  ]);
}

/** Valeurs de formulaire reconstruites depuis un business case enregistré (relu au montage). */
export function businessCaseFormValuesFromInput(input: BusinessCaseInput): BusinessCaseFormValues {
  return {
    capex: String(input.capex),
    annualGains: String(input.annualGains),
    annualCosts: String(input.annualCosts),
    horizonYears: String(input.horizonYears),
    discountRatePercent: input.discountRatePercent === null ? "" : String(input.discountRatePercent),
  };
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
