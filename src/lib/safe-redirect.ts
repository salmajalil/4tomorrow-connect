// Chemin de redirection après connexion (`next`), lu dans l'URL donc non
// fiable : seul un chemin relatif à ce site est accepté. "@evil.com" (collé
// derrière l'origine, il devient "https://site@evil.com"), "//evil.com" et
// "/\evil.com" (que les navigateurs lisent comme "//evil.com") mènent tous
// vers un autre domaine — ils retombent sur la valeur par défaut.
export function safeNextPath(next: string | null | undefined, fallback = "/connect"): string {
  if (!next) return fallback;
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
