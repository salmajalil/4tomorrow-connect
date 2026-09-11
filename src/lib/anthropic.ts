import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only wrapper. Importing "server-only" makes it a build error to
// accidentally pull this into a client bundle, which is how ANTHROPIC_API_KEY
// stays off the client no matter what imports it later.
let client: Anthropic | null = null;

// Hard ceiling on a single Anthropic call attempt. Set with headroom under
// the Vercel function's own maxDuration (see src/app/api/match/route.ts) so
// our own timeout fires first and the user gets an actionable error instead
// of a raw platform 504. maxRetries is forced to 0 below — the SDK retries
// timeouts by default, which silently turns one budget into 2x that and was
// the original cause of the 504s this timeout is meant to prevent.
//
// A single, non-retried, web_search-augmented call was observed taking
// 56s+ end to end in production, so this is set with real headroom above
// that rather than the 30s the brief originally asked for — that figure
// didn't survive contact with how long multi-round web search actually
// takes for a well-detailed project description.
export const MATCHING_TIMEOUT_MS = 170_000;

export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your server environment (.env.local locally, Vercel project settings in production) — never expose it with a NEXT_PUBLIC_ prefix."
    );
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: MATCHING_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return client;
}

// Overridable via env in case a given Anthropic account doesn't have this
// exact model id enabled yet.
export const MATCHING_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
