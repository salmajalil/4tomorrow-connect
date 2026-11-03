// F01 — Matrice des compétences : calcul déterministe, côté serveur.
// Aucune valeur ici ne vient de l'IA — écart et priorité pondérée sont
// calculés uniquement à partir des niveaux saisis pour chaque cellule
// rôle × domaine. L'IA garde un rôle distinct : une fois qu'un écart est
// identifié ici, elle peut être invoquée (via le générateur de formation
// existant, src/lib/learn.ts) pour RÉDIGER le contenu pédagogique d'une
// formation sur ce sujet — jamais pour décider si l'écart existe ou à
// quel point il est prioritaire.
//
// Règles (brief F01) :
//   écart = requis − démontré (jamais négatif) ;
//   priorité pondérée = écart × criticité ;
//   une démonstration auto-évaluée reste « à confirmer », jamais prise
//     pour un niveau validé ;
//   une formation est suggérée par écart, via un petit catalogue éditable
//     (domaine -> intitulé suggéré), jamais inventée par le modèle.
import { DOMAINS, type Domain } from "@/lib/decide";

export { DOMAINS };
export type { Domain };

export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 4;
export const CRITICALITY_MIN = 1;
export const CRITICALITY_MAX = 5;

export type SkillConfirmStatus = "à confirmer" | "confirmé";

export interface SkillAssessmentInput {
  role: string;
  domain: Domain;
  required: number; // 0-4
  demonstrated: number; // 0-4
  criticality: number; // 1-5
  selfAssessed: boolean;
}

export interface SkillGapResult {
  role: string;
  domain: Domain;
  required: number;
  demonstrated: number;
  criticality: number;
  gap: number;
  weighted: number;
  status: SkillConfirmStatus;
  selfAssessed: boolean;
}

function inLevelRange(n: number): boolean {
  return Number.isInteger(n) && n >= SKILL_LEVEL_MIN && n <= SKILL_LEVEL_MAX;
}

function inCriticalityRange(n: number): boolean {
  return Number.isInteger(n) && n >= CRITICALITY_MIN && n <= CRITICALITY_MAX;
}

/** Valide les niveaux saisis ; retourne la liste des erreurs (vide = valide). */
export function validateSkillInputs(inputs: SkillAssessmentInput[]): string[] {
  const errors: string[] = [];
  for (const input of inputs) {
    const label = input.role.trim() || "(rôle sans nom)";
    if (!input.role.trim()) {
      errors.push(`Un rôle est vide — donnez un nom à chaque rôle évalué.`);
    }
    if (!inLevelRange(input.required)) {
      errors.push(`${label} / ${input.domain} : le niveau requis doit être un entier entre ${SKILL_LEVEL_MIN} et ${SKILL_LEVEL_MAX}.`);
    }
    if (!inLevelRange(input.demonstrated)) {
      errors.push(`${label} / ${input.domain} : le niveau démontré doit être un entier entre ${SKILL_LEVEL_MIN} et ${SKILL_LEVEL_MAX}.`);
    }
    if (!inCriticalityRange(input.criticality)) {
      errors.push(`${label} / ${input.domain} : la criticité doit être un entier entre ${CRITICALITY_MIN} et ${CRITICALITY_MAX}.`);
    }
  }
  return errors;
}

/**
 * Calcule écart, priorité pondérée et statut pour chaque cellule évaluée.
 * Fonction pure : mêmes entrées => mêmes sorties, jamais d'appel réseau ni d'IA.
 */
export function computeSkillGaps(inputs: SkillAssessmentInput[]): SkillGapResult[] {
  return inputs.map((input) => {
    const gap = Math.max(0, input.required - input.demonstrated);
    const weighted = gap * input.criticality;
    const status: SkillConfirmStatus = input.selfAssessed ? "à confirmer" : "confirmé";
    return {
      role: input.role.trim(),
      domain: input.domain,
      required: input.required,
      demonstrated: input.demonstrated,
      criticality: input.criticality,
      gap,
      weighted,
      status,
      selfAssessed: input.selfAssessed,
    };
  });
}

/** Trie par priorité pondérée décroissante (puis écart, puis rôle/domaine) — déterministe. */
export function rankSkillGaps(results: SkillGapResult[]): SkillGapResult[] {
  return [...results].sort(
    (a, b) => b.weighted - a.weighted || b.gap - a.gap || a.role.localeCompare(b.role) || a.domain.localeCompare(b.domain)
  );
}

/** Catalogue de formations par défaut (domaine -> intitulé suggéré) : un point de départ éditable, jamais généré par l'IA. */
export const DEFAULT_TRAINING_SUGGESTIONS: Record<Domain, string> = {
  manufacturing: "Fondamentaux lean & pilotage de production",
  rd: "Méthodes d'innovation et gestion de portefeuille R&D",
  gtm: "Stratégie de mise sur le marché et vente B2B industrielle",
  strategy: "Construire et arbitrer une feuille de route stratégique",
  digitalization: "Digitalisation industrielle : des données à la décision",
};

/** Une formation suggérée par écart (jamais plus d'une par domaine) — le catalogue est la seule source, jamais l'IA. */
export function suggestTrainingForGap(domain: Domain, catalog: Partial<Record<Domain, string>>): string | null {
  return catalog[domain] ?? DEFAULT_TRAINING_SUGGESTIONS[domain] ?? null;
}

/** Un écart par domaine (le plus prioritaire par domaine), pour ne jamais proposer deux formations sur le même sujet. */
export function topGapPerDomain(results: SkillGapResult[]): SkillGapResult[] {
  const ranked = rankSkillGaps(results.filter((r) => r.gap > 0));
  const seen = new Set<Domain>();
  const out: SkillGapResult[] = [];
  for (const r of ranked) {
    if (seen.has(r.domain)) continue;
    seen.add(r.domain);
    out.push(r);
  }
  return out;
}
