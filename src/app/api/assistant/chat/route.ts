import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import { buildAssistantSystemPrompt, type ChatMessage } from "@/lib/assistant";
import { getLanguage } from "@/lib/i18n/language";
import { streamJsonResponse } from "@/lib/streaming-json-response";

// Tomorrow's chat — still lightweight (no database reads), but now has
// web_search for real-world lookups (see buildAssistantSystemPrompt), so
// the ceiling has to cover an occasional search round, not just a plain
// completion.
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20),
  pathname: z.string().trim().default("/"),
  webSearchEnabled: z.boolean().default(false),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  // Never reachable anonymously: every call costs a real model call (and
  // possibly web_search), so it is gated on a session like every other AI
  // route (same pattern as src/app/api/decide/roadmap/route.ts).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  const createCall = () =>
    anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 800,
      system: buildAssistantSystemPrompt(language, body.pathname, body.webSearchEnabled),
      messages: body.messages.map((m): ChatMessage => ({ role: m.role, content: m.content })),
      ...(body.webSearchEnabled
        ? { tools: [{ type: "web_search_20260318" as const, name: "web_search" as const, max_uses: 2 }] }
        : {}),
    });

  // Wrapped so the connection stays visibly alive for the AI call's whole
  // duration instead of one long silent wait (see
  // src/lib/streaming-json-response.ts) — web_search can take this well
  // past what a quiet connection survives on mobile. Thrown errors below
  // become the same { error } body callers already expect.
  return streamJsonResponse(async () => {
    let response;
    try {
      try {
        response = await createCall();
      } catch (err) {
        // Same transient-overload retry as every other Anthropic call in the
        // app (see learn.ts) — Tomorrow is the most visible, most-used
        // surface, so a single 429/529 blip showing as a dead chat bubble is
        // the worst possible place to skip this.
        if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          response = await createCall();
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(
          language === "en"
            ? "Tomorrow couldn't reply. Try again in a moment."
            : "Tomorrow n'a pas pu répondre. Réessaie dans un instant."
        );
      }
      throw new Error(
        language === "en" ? "Tomorrow took too long to respond. Try again." : "Tomorrow a mis trop de temps à répondre. Réessaie."
      );
    }

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { reply: reply || "..." };
  });
}
