import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { aiQuotaWindowStart, DEFAULT_AI_QUOTA_PER_DAY, isAiQuotaExceeded } from "@/lib/ai-quota-calc";

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

// ---------------------------------------------------------------------------
// Daily AI quota (per user, per route) backed by the `ai_usage` table
// (supabase/migrations/0023_ai_usage.sql). No Redis/Upstash: count the rows of
// the last 24h, refuse past the limit, otherwise log this call and go on.
// The decision itself is the pure, tested isAiQuotaExceeded().
//
// Not strictly atomic (two concurrent requests can both read N-1 and pass) —
// acceptable for a cost/abuse guard; the overshoot is bounded by concurrency.
// ---------------------------------------------------------------------------

export class AiQuotaExceededError extends Error {
  constructor(public readonly route: string, public readonly maxPerDay: number) {
    super(`AI quota exceeded on ${route} (${maxPerDay}/24h)`);
    this.name = "AiQuotaExceededError";
  }
}

export async function assertAiQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  route: string,
  maxPerDay: number = DEFAULT_AI_QUOTA_PER_DAY
): Promise<void> {
  const { count, error: countError } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gt("created_at", aiQuotaWindowStart(new Date()));

  // Fail closed: if usage can't be read, don't hand out a free AI call.
  if (countError) throw new Error(`ai_usage count failed: ${countError.message}`);

  if (isAiQuotaExceeded(count ?? 0, maxPerDay)) {
    throw new AiQuotaExceededError(route, maxPerDay);
  }

  const { error: insertError } = await supabase.from("ai_usage").insert({ user_id: userId, route });
  if (insertError) throw new Error(`ai_usage insert failed: ${insertError.message}`);
}

// Route-handler wrapper around assertAiQuota: returns the HTTP response to
// send back (429 on quota, 503 if usage couldn't be checked), or null to go on.
export async function enforceAiQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  route: string,
  language: "fr" | "en",
  maxPerDay: number = DEFAULT_AI_QUOTA_PER_DAY
): Promise<NextResponse | null> {
  try {
    await assertAiQuota(supabase, userId, route, maxPerDay);
    return null;
  } catch (err) {
    if (err instanceof AiQuotaExceededError) {
      return NextResponse.json(
        {
          error:
            language === "en"
              ? "AI usage limit reached, try again tomorrow."
              : "Limite d'utilisation IA atteinte, réessaie demain.",
        },
        { status: 429 }
      );
    }
    console.error("[ai-quota]", err);
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't check your AI usage. Try again in a moment."
            : "Impossible de vérifier ton utilisation IA. Réessaie dans un instant.",
      },
      { status: 503 }
    );
  }
}
