// L09 — Validation CEO : jeton à usage unique, lié à la décision et à sa
// version, 72h. Logique pure (émission du contenu du jeton + règles de
// consommation) — la génération du secret aléatoire et la lecture/écriture
// en base restent dans la route API qui appelle ces fonctions.
//
// Règles (brief VALIDATION CEO) :
//   lien à usage unique, durée limitée (72h), lié à la décision ET sa version ;
//   ouvrir le lien ne valide rien : confirmation explicite obligatoire ;
//   refusé si déjà servi, expiré, ou si la décision a changé depuis l'envoi.
// Pure module, no "server-only" guard — see decide-business-case-calc.ts for
// why (unit-tested directly, nothing secret in here).

export const VALIDATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

export type ValidationOutcome = "validated" | "needs_more_info" | "rejected";

export interface ValidationTokenRecord {
  transformationId: string;
  trajectoryId: string;
  decisionSnapshot: string; // ISO timestamp, copie de transformations.decision_updated_at à l'émission
  expiresAt: string; // ISO timestamp
  usedAt: string | null;
  // SHA-256 de la décision à l'émission (src/lib/decision-hash.ts, 0026).
  // Absent/null pour un jeton émis avant 0026 : seule la vérification
  // trajectoire + decisionSnapshot s'applique alors.
  decisionHash?: string | null;
}

export interface CurrentDecisionState {
  transformationId: string;
  trajectoryId: string | null; // selected_trajectory_id actuel
  decisionUpdatedAt: string; // ISO timestamp actuel
  // Empreinte recalculée côté serveur sur l'état actuel de la décision.
  // Absente côté client (historique) : la comparaison est alors ignorée.
  decisionHash?: string | null;
}

export type ValidationRefusalCode = "not_confirmed" | "used" | "expired" | "other_project" | "decision_changed";

export interface ConsumeResult {
  ok: boolean;
  reason: string | null;
  // Code stable du motif de refus — permet aux écrans/routes de traduire le
  // motif (fr/en) sans dépendre du texte français ci-dessus.
  code: ValidationRefusalCode | null;
}

const DECISION_CHANGED_REASON = "Décision modifiée depuis l'envoi — ce lien n'est plus valide, il faut en réémettre un.";

/**
 * Motif obligatoire : un refus ou une demande de complément doit toujours
 * être expliqué par le CEO lui-même (jamais pré-rempli, jamais par l'IA) ;
 * une validation simple reste possible sans commentaire.
 */
export function isNoteRequired(outcome: ValidationOutcome): boolean {
  return outcome === "rejected" || outcome === "needs_more_info";
}

/** True si le motif fourni satisfait la règle ci-dessus (espaces seuls = vide). */
export function isOutcomeNoteValid(outcome: ValidationOutcome, note: string | null | undefined): boolean {
  return !isNoteRequired(outcome) || (note ?? "").trim().length > 0;
}

/** Calcule l'expiration d'un nouveau jeton émis à `issuedAt`. */
export function computeExpiresAt(issuedAt: Date): string {
  return new Date(issuedAt.getTime() + VALIDATION_TOKEN_TTL_MS).toISOString();
}

/**
 * Vérifie si une confirmation explicite sur un jeton doit être acceptée.
 * Fonction pure : ne touche jamais la base, ne marque rien "used" — c'est à
 * l'appelant de persister `usedAt`/`outcome` une fois `ok: true` retourné.
 */
export function evaluateConsumption(
  token: ValidationTokenRecord,
  current: CurrentDecisionState,
  now: Date,
  explicitlyConfirmed: boolean
): ConsumeResult {
  if (!explicitlyConfirmed) {
    return { ok: false, reason: "Confirmation explicite requise : ouvrir le lien ne valide rien.", code: "not_confirmed" };
  }
  if (token.usedAt !== null) {
    return { ok: false, reason: "Ce lien a déjà été utilisé.", code: "used" };
  }
  if (now.getTime() > Date.parse(token.expiresAt)) {
    return { ok: false, reason: "Ce lien a expiré. Demandez-en un nouveau.", code: "expired" };
  }
  if (token.transformationId !== current.transformationId) {
    return { ok: false, reason: "Ce lien concerne un autre projet.", code: "other_project" };
  }
  if (current.trajectoryId !== token.trajectoryId) {
    return { ok: false, reason: DECISION_CHANGED_REASON, code: "decision_changed" };
  }
  if (current.decisionUpdatedAt !== token.decisionSnapshot) {
    return { ok: false, reason: DECISION_CHANGED_REASON, code: "decision_changed" };
  }
  // Empreinte du contenu de la décision : compare seulement quand les deux
  // côtés en ont une (jeton post-0026 ET état courant calculé côté serveur).
  if (token.decisionHash && current.decisionHash && token.decisionHash !== current.decisionHash) {
    return { ok: false, reason: DECISION_CHANGED_REASON, code: "decision_changed" };
  }
  return { ok: true, reason: null, code: null };
}

/** True si un jeton (non consommé) est encore valide pour être affiché, sans le consommer. */
export function isTokenStillUsable(token: ValidationTokenRecord, current: CurrentDecisionState, now: Date): ConsumeResult {
  return evaluateConsumption(token, current, now, true);
}

export type ValidationHistoryStatus = ValidationOutcome | "pending" | "expired" | "outdated";

/**
 * État à afficher pour une ligne d'historique côté porteur du projet : le
 * résultat du CEO s'il a répondu, sinon « en attente » uniquement si le
 * jeton est encore utilisable (isTokenStillUsable) — un jeton expiré ou
 * dont la décision a changé depuis l'envoi n'est jamais montré « en attente ».
 */
export function validationHistoryStatus(
  token: ValidationTokenRecord & { outcome: ValidationOutcome | null },
  current: CurrentDecisionState | null,
  now: Date
): ValidationHistoryStatus {
  if (token.outcome) return token.outcome;
  if (now.getTime() > Date.parse(token.expiresAt)) return "expired";
  if (!current) return "pending";
  const usable = isTokenStillUsable(token, current, now);
  if (usable.ok) return "pending";
  return usable.code === "expired" ? "expired" : "outdated";
}
