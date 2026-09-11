import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only wrapper. Importing "server-only" makes it a build error to
// accidentally pull this into a client bundle, which is how ANTHROPIC_API_KEY
// stays off the client no matter what imports it later.
let client: Anthropic | null = null;

// Hard ceiling on the Anthropic call — web_search can take a while, but the
// UI needs to stop waiting and offer a retry rather than hang indefinitely.
export const MATCHING_TIMEOUT_MS = 30_000;

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
    });
  }
  return client;
}

// Overridable via env in case a given Anthropic account doesn't have this
// exact model id enabled yet.
export const MATCHING_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
