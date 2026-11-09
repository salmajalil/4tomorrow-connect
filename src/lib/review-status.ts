// Confiance v2 — statut de revue humaine des livrables clés (executive
// report, business case) : « Brouillon IA » → « Revu » → « Validé ».
//
// Pure, sans accès réseau ni base : dit qui voit quoi et quelle transition
// est permise ; la route /api/review-status fait l'écriture. Le statut
// n'est JAMAIS posé par l'IA — c'est toujours un geste humain explicite
// (bouton « Marquer comme revu » / « Valider »), et il retombe à
// « ai_draft » en base dès que le contenu change (voir
// supabase/migrations/0026_review_status_and_validation_hash.sql).
import { canPerform, type TransformationActor } from "@/lib/transformation-roles";
import type { ReviewStatusValue } from "@/types/database";

export type ReviewStatus = ReviewStatusValue;

export const REVIEW_STATUSES: readonly ReviewStatus[] = ["ai_draft", "reviewed", "validated"] as const;

/**
 * Livrables Livrer soumis au circuit de revue (les autres restent des
 * outils de travail du consultant, sans statut de diffusion).
 */
export const REVIEWABLE_DELIVERABLE_KINDS = ["executive_report"] as const;

export function isReviewableDeliverableKind(kind: string): boolean {
  return (REVIEWABLE_DELIVERABLE_KINDS as readonly string[]).includes(kind);
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

/** Une ligne lue en base avant 0026 n'a pas la colonne : on la traite comme un brouillon (personne ne l'a relue). */
export function normalizeReviewStatus(value: unknown): ReviewStatus {
  return isReviewStatus(value) ? value : "ai_draft";
}

/** Peut relire / valider un livrable (et donc aussi voir un brouillon IA) : propriétaire ou consultant. */
export function canReview(actor: TransformationActor | null): boolean {
  return actor !== null && canPerform(actor, "review_deliverable");
}

/**
 * Un brouillon IA n'est visible que de celui qui le porte (propriétaire /
 * consultant) — jamais du client ni du CEO, qui ne voient que ce qu'un
 * humain a relu. Un acteur inconnu (null) ne voit rien.
 */
export function isVisibleTo(actor: TransformationActor | null, status: ReviewStatus): boolean {
  if (actor === null) return false;
  if (status === "ai_draft") return canReview(actor);
  return canPerform(actor, "read");
}

/** Filtre une liste de livrables selon ce que l'acteur a le droit de voir. */
export function filterVisible<T extends { review_status?: unknown }>(actor: TransformationActor | null, rows: T[]): T[] {
  return rows.filter((row) => isVisibleTo(actor, normalizeReviewStatus(row.review_status)));
}

/**
 * Livrables Livrer : seuls les types soumis à revue (executive report) sont
 * masqués tant qu'ils sont en brouillon IA pour un client / CEO ; les
 * autres types ne passent pas par ce circuit et restent visibles comme avant.
 */
export function filterVisibleDeliverables<T extends { kind: string; review_status?: unknown }>(
  actor: TransformationActor | null,
  rows: T[]
): { visible: T[]; hiddenDraftKinds: string[] } {
  const visible: T[] = [];
  const hiddenDraftKinds: string[] = [];
  for (const row of rows) {
    if (!isReviewableDeliverableKind(row.kind) || isVisibleTo(actor, normalizeReviewStatus(row.review_status))) {
      visible.push(row);
    } else {
      hiddenDraftKinds.push(row.kind);
    }
  }
  return { visible, hiddenDraftKinds };
}

/**
 * La seule transition suivante permise depuis un statut donné : on monte
 * d'un cran à la fois (ai_draft → reviewed → validated), jamais de saut
 * direct « brouillon IA → validé » sans relecture, et rien après « validé ».
 */
export function nextReviewStatus(current: ReviewStatus): ReviewStatus | null {
  if (current === "ai_draft") return "reviewed";
  if (current === "reviewed") return "validated";
  return null;
}

export type ReviewTransitionRefusal = "not_allowed" | "invalid_transition";

export function evaluateReviewTransition(
  actor: TransformationActor | null,
  current: ReviewStatus,
  target: ReviewStatus
): { ok: true } | { ok: false; code: ReviewTransitionRefusal } {
  if (!canReview(actor)) return { ok: false, code: "not_allowed" };
  if (nextReviewStatus(current) !== target) return { ok: false, code: "invalid_transition" };
  return { ok: true };
}
