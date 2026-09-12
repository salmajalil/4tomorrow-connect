// A timed-out or crashed function returns a plain-text/HTML body, not JSON
// (Vercel's FUNCTION_INVOCATION_TIMEOUT page, for instance). res.json() then
// throws — on Safari with the cryptic "The string did not match the
// expected pattern.", which is really just JSON.parse choking on non-JSON.
// Give the user something they can act on instead of that raw message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the untyped res.json() this replaces; each caller casts its own shape.
export async function parseJsonResponse(res: Response): Promise<{ data: any }> {
  try {
    return { data: await res.json() };
  } catch {
    throw new Error(
      res.status === 504 || !res.ok
        ? "Le serveur a mis trop de temps à répondre (délai dépassé). Réessaie."
        : "Réponse du serveur illisible. Réessaie."
    );
  }
}
