// C02 — Pertinence fournisseur : calcul déterministe, côté serveur.
// Aucune valeur ici ne vient de l'IA — éligibilité, score et statut
// "recommandé" sont calculés uniquement à partir des prérequis et critères
// saisis par l'utilisateur pour un match donné (voir src/lib/matching.ts
// pour la découverte du candidat lui-même, qui reste assistée par IA+web
// search : ce module n'intervient qu'une fois un candidat identifié, pour
// décider s'il est réellement recommandable).
//
// Règles (brief C02) :
//   prérequis éliminatoires d'abord (un seul non rempli => inéligible) ;
//   seuls les critères au statut de preuve "vérifié" comptent dans le score ;
//   jamais "recommandé" sans tous les justificatifs (éligible ET aucune
//     preuve manquante) ;
//   chaque pièce manquante devient une action (voir missingProofs ci-dessous
//     — ce dépôt n'a pas encore de système d'actions transverse au moment où
//     ce module est écrit ; l'appelant est responsable de transformer
//     missingProofs en actions une fois ce système disponible).
export type ProofStatus = "vérifié" | "manquant" | "périmé";

export interface SupplierPrerequisite {
  label: string;
  met: boolean;
}

export interface SupplierCriterion {
  label: string;
  score: number | null; // 1-5, note du fournisseur sur ce critère
  proofStatus: ProofStatus;
  proofDate: string | null; // ISO date du justificatif, requis si proofStatus === "vérifié"
}

export interface SupplierAssessmentResult {
  eligible: boolean;
  failedPrerequisites: string[];
  score: number | null; // moyenne des critères "vérifié" seulement ; null si aucun
  verifiedCount: number;
  totalCriteria: number;
  missingProofs: SupplierCriterion[]; // statut "manquant" ou "périmé" — une pièce par action à créer
  recommended: boolean; // éligible ET missingProofs.length === 0
}

const SCORE_MIN = 1;
const SCORE_MAX = 5;

function inScoreRange(n: number): boolean {
  return Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

/** Valide prérequis et critères saisis ; retourne la liste des erreurs (vide = valide). */
export function validateSupplierInputs(
  prerequisites: SupplierPrerequisite[],
  criteria: SupplierCriterion[]
): string[] {
  const errors: string[] = [];
  for (const p of prerequisites) {
    if (!p.label.trim()) errors.push("Chaque prérequis doit avoir un intitulé.");
  }
  for (const c of criteria) {
    if (!c.label.trim()) {
      errors.push("Chaque critère doit avoir un intitulé.");
      continue;
    }
    if (c.proofStatus === "vérifié") {
      if (c.score === null || !inScoreRange(c.score)) {
        errors.push(`${c.label} : une note entre ${SCORE_MIN} et ${SCORE_MAX} est requise pour un critère vérifié.`);
      }
      if (!c.proofDate) {
        errors.push(`${c.label} : une date de justificatif est requise pour un critère vérifié.`);
      }
    }
  }
  return errors;
}

/**
 * Calcule éligibilité, score et statut "recommandé" pour un fournisseur.
 * Fonction pure : mêmes entrées => mêmes sorties, jamais d'appel réseau ni d'IA.
 */
export function computeSupplierAssessment(
  prerequisites: SupplierPrerequisite[],
  criteria: SupplierCriterion[]
): SupplierAssessmentResult {
  const failedPrerequisites = prerequisites.filter((p) => !p.met).map((p) => p.label);
  const eligible = failedPrerequisites.length === 0;

  const verified = criteria.filter((c) => c.proofStatus === "vérifié" && c.score !== null);
  const score = verified.length > 0 ? verified.reduce((sum, c) => sum + (c.score ?? 0), 0) / verified.length : null;

  const missingProofs = criteria.filter((c) => c.proofStatus !== "vérifié");

  // Un fournisseur sous prérequis manquant n'est jamais "recommandé", même si
  // tous ses critères sont par ailleurs vérifiés — l'éligibilité prime.
  const recommended = eligible && missingProofs.length === 0 && criteria.length > 0;

  return {
    eligible,
    failedPrerequisites,
    score: score !== null ? Math.round(score * 100) / 100 : null,
    verifiedCount: verified.length,
    totalCriteria: criteria.length,
    missingProofs,
    recommended,
  };
}
