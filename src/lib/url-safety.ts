// Normalise une URL venant d'une source non fiable (sortie du modèle, saisie
// libre) avant qu'elle ne devienne un `href` : le résultat est toujours une
// URL http(s) absolue valide, ou undefined. Un schéma dangereux
// (javascript:, data:, ...) ne passe jamais tel quel. Partagé par Connecter
// (matching.ts) et Décider (decide/scenarios).
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

// Variante stricte pour un lien déjà stocké (ex. export PDF) : n'accepte que
// ce qui commence explicitement par http:// ou https://, sans réécriture.
export function isHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
