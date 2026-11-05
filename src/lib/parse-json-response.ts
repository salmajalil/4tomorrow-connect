// A timed-out or crashed function returns a plain-text/HTML body, not JSON
// (Vercel's FUNCTION_INVOCATION_TIMEOUT page, for instance). res.json() then
// throws — on Safari with the cryptic "The string did not match the
// expected pattern.", which is really just JSON.parse choking on non-JSON.
// Give the user something they can act on instead of that raw message.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the untyped res.json() this replaces; each caller casts its own shape.
export async function parseJsonResponse(res: Response): Promise<{ data: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as the return type above.
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.status === 504 || !res.ok
        ? "Le serveur a mis trop de temps à répondre (délai dépassé). Réessaie."
        : "Réponse du serveur illisible. Réessaie."
    );
  }
  // Streamed routes (src/lib/streaming-json-response.ts) answer 200 at the
  // transport level no matter the outcome — the HTTP status line has to be
  // sent before we know whether the slow work it's keeping alive for will
  // succeed, so failure is signalled through `data.error` instead. Throwing
  // on it here, before any caller's own `if (!res.ok)` check, means that
  // check still works for every other route (res.ok is true so it never
  // fires) while a streamed route's error is never silently swallowed.
  if (data && typeof data === "object" && typeof data.error === "string") {
    throw new Error(data.error);
  }
  return { data };
}
