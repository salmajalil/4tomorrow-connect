import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import { buildAssistantSystemPrompt, type ChatMessage } from "@/lib/assistant";
import { getLanguage } from "@/lib/i18n/language";

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
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const anthropic = getAnthropicClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 800,
      system: buildAssistantSystemPrompt(language, body.pathname, body.webSearchEnabled),
      messages: body.messages.map((m): ChatMessage => ({ role: m.role, content: m.content })),
      ...(body.webSearchEnabled
        ? { tools: [{ type: "web_search_20260318" as const, name: "web_search" as const, max_uses: 2 }] }
        : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
      return NextResponse.json(
        {
          error:
            language === "en"
              ? "Tomorrow couldn't reply. Try again in a moment."
              : "Tomorrow n'a pas pu répondre. Réessaie dans un instant.",
        },
        { status }
      );
    }
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Tomorrow took too long to respond. Try again."
            : "Tomorrow a mis trop de temps à répondre. Réessaie.",
      },
      { status: 504 }
    );
  }

  const reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return NextResponse.json({ reply: reply || "..." });
}
