import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// L09 — empreinte SHA-256 de la décision envoyée au CEO (benchmark Palantir
// AIP Checkpoints : on valide une version précise, pas « la décision du
// moment »). Calculée côté serveur à l'émission du jeton (stockée dans
// ceo_validation_tokens.decision_hash) puis recalculée à la consommation :
// si elle diffère, evaluateConsumption (src/lib/validation-token.ts) refuse
// le lien avec le code "decision_changed".
//
// Elle prolonge le decision_snapshot existant (decision_updated_at, qui ne
// bouge qu'au changement de trajectoire) en couvrant aussi le CONTENU
// affiché au CEO : nom, posture, description, briefing exécutif et
// indicateurs de la trajectoire retenue. Une régénération de ce contenu
// sans changement de trajectoire invalide donc aussi le lien.
//
// Pas de garde "server-only" (testé directement par Vitest, comme
// decide-business-case-calc.ts) — mais node:crypto : à n'importer que
// depuis une route ou un composant serveur.

export interface DecisionFingerprintInput {
  transformationId: string;
  trajectoryId: string | null;
  decisionUpdatedAt: string;
  trajectory: {
    name: string | null;
    stance: string | null;
    description: string | null;
    executiveBriefing: string | null;
    indicators: unknown;
  } | null;
}

/** JSON déterministe : clés d'objet triées récursivement, `undefined` traité comme absent. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v === undefined ? null : v)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Le JSON stable exact qui est haché — exposé pour les tests et le débogage. */
export function decisionFingerprint(input: DecisionFingerprintInput): string {
  // decision_updated_at est normalisé en ISO : Postgres peut renvoyer le même
  // instant sous deux écritures (« +00:00 » vs « Z »), ce qui ne doit pas
  // passer pour un changement de décision.
  const parsed = Date.parse(input.decisionUpdatedAt);
  const decisionUpdatedAt = Number.isNaN(parsed) ? input.decisionUpdatedAt : new Date(parsed).toISOString();
  return stableStringify({
    v: 1,
    transformationId: input.transformationId,
    trajectoryId: input.trajectoryId,
    decisionUpdatedAt,
    trajectory: input.trajectory,
  });
}

/** SHA-256 (hex) de la décision. Déterministe : mêmes champs => même empreinte. */
export function hashDecision(input: DecisionFingerprintInput): string {
  return createHash("sha256").update(decisionFingerprint(input), "utf8").digest("hex");
}

/**
 * Lit l'état courant de la décision (trajectoire retenue + son contenu) et
 * renvoie son empreinte. Utilisé à l'émission du jeton ET à sa
 * consommation, pour hacher exactement les mêmes champs des deux côtés.
 */
export async function fetchDecisionHash(
  supabase: SupabaseClient<Database>,
  tx: { id: string; selected_trajectory_id: string | null; decision_updated_at: string }
): Promise<string> {
  let trajectory: DecisionFingerprintInput["trajectory"] = null;
  if (tx.selected_trajectory_id) {
    const { data } = await supabase
      .from("trajectories")
      .select("name, stance, description, executive_briefing, indicators")
      .eq("id", tx.selected_trajectory_id)
      .maybeSingle();
    if (data) {
      trajectory = {
        name: data.name ?? null,
        stance: data.stance ?? null,
        description: data.description ?? null,
        executiveBriefing: data.executive_briefing ?? null,
        indicators: data.indicators ?? null,
      };
    }
  }
  return hashDecision({
    transformationId: tx.id,
    trajectoryId: tx.selected_trajectory_id,
    decisionUpdatedAt: tx.decision_updated_at,
    trajectory,
  });
}
