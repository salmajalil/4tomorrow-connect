// Quota IA quotidien : logique de décision pure, sans réseau ni base, testée
// par Vitest (ai-quota-calc.test.ts). La lecture/écriture de la table
// ai_usage vit dans assertAiQuota (src/lib/anthropic.ts), qui s'appuie sur
// ces deux fonctions.

// Fenêtre glissante : 24 heures avant `now`.
export const AI_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

// Quota par défaut, par utilisateur et par route, sur la fenêtre glissante.
export const DEFAULT_AI_QUOTA_PER_DAY = 30;

// Début de la fenêtre glissante, au format ISO attendu par Supabase
// (`created_at > <ce timestamp>`).
export function aiQuotaWindowStart(now: Date): string {
  return new Date(now.getTime() - AI_QUOTA_WINDOW_MS).toISOString();
}

// true quand l'appel suivant dépasserait le quota : `usedInWindow` appels
// déjà comptés sur la fenêtre, `maxPerDay` autorisés. Un maximum invalide
// (négatif, NaN) bloque par prudence plutôt que d'ouvrir les vannes.
export function isAiQuotaExceeded(usedInWindow: number, maxPerDay: number): boolean {
  if (!Number.isFinite(maxPerDay) || maxPerDay < 0) return true;
  const used = Number.isFinite(usedInWindow) && usedInWindow > 0 ? usedInWindow : 0;
  return used >= maxPerDay;
}
