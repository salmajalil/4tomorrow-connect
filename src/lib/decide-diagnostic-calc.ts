// D01 — Diagnostic de maturité : calcul déterministe, côté serveur.
// Aucune valeur ici ne vient de l'IA — gap/priorité/statut sont calculés
// uniquement à partir des niveaux saisis par l'utilisateur pour chaque
// capacité (un par domaine détecté par le diagnostic qualitatif existant).
//
// Règles (brief D01) :
//   écart = cible − observé (jamais négatif : un niveau au-delà de la cible
//     n'est pas un écart) ;
//   priorité = écart × importance ;
//   un niveau sans preuve reste « non vérifié ».
import type { Domain } from "@/lib/decide";

export const CAPABILITY_LEVEL_MIN = 1;
export const CAPABILITY_LEVEL_MAX = 5;

export type CapabilityStatus = "vérifié" | "non vérifié";

export interface CapabilityAssessmentInput {
  domain: Domain;
  observed: number; // 1-5, niveau actuel
  target: number; // 1-5, niveau cible
  importance: number; // 1-5, poids relatif de cette capacité
  proofNote: string; // preuve (texte libre) ; vide = pas de preuve
}

export interface CapabilityGapResult {
  domain: Domain;
  observed: number;
  target: number;
  importance: number;
  gap: number;
  priority: number;
  status: CapabilityStatus;
  proofNote: string;
}

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= CAPABILITY_LEVEL_MIN && n <= CAPABILITY_LEVEL_MAX;
}

/** Valide les niveaux saisis ; retourne la liste des erreurs (vide = valide). */
export function validateCapabilityInputs(inputs: CapabilityAssessmentInput[]): string[] {
  const errors: string[] = [];
  for (const input of inputs) {
    if (!inRange(input.observed)) {
      errors.push(`${input.domain} : le niveau observé doit être un entier entre ${CAPABILITY_LEVEL_MIN} et ${CAPABILITY_LEVEL_MAX}.`);
    }
    if (!inRange(input.target)) {
      errors.push(`${input.domain} : le niveau cible doit être un entier entre ${CAPABILITY_LEVEL_MIN} et ${CAPABILITY_LEVEL_MAX}.`);
    }
    if (!inRange(input.importance)) {
      errors.push(`${input.domain} : l'importance doit être un entier entre ${CAPABILITY_LEVEL_MIN} et ${CAPABILITY_LEVEL_MAX}.`);
    }
  }
  return errors;
}

/**
 * Calcule écart, priorité et statut pour chaque capacité évaluée.
 * Fonction pure : mêmes entrées => mêmes sorties, jamais d'appel réseau ni d'IA.
 */
export function computeCapabilityGaps(inputs: CapabilityAssessmentInput[]): CapabilityGapResult[] {
  return inputs.map((input) => {
    const gap = Math.max(0, input.target - input.observed);
    const priority = gap * input.importance;
    const proofNote = input.proofNote.trim();
    const status: CapabilityStatus = proofNote.length > 0 ? "vérifié" : "non vérifié";
    return {
      domain: input.domain,
      observed: input.observed,
      target: input.target,
      importance: input.importance,
      gap,
      priority,
      status,
      proofNote,
    };
  });
}

/** Trie par priorité décroissante (puis écart décroissant, puis domaine) — déterministe, aucun hasard. */
export function rankCapabilityGaps(results: CapabilityGapResult[]): CapabilityGapResult[] {
  return [...results].sort((a, b) => b.priority - a.priority || b.gap - a.gap || a.domain.localeCompare(b.domain));
}
