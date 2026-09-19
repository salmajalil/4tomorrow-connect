import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import { buildAssistantSystemPrompt, type ChatMessage } from "@/lib/assistant";
import { getLanguage } from "@/lib/i18n/language";

// Tomorrow's chat — deliberately cheap and fast: no web_search, modest
// max_tokens, no database reads. It's a conversational guide, not a
// generation engine, so it doesn't need the longer budgets the module
// generation routes use.
export const maxDuration = 30;

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20),
  pathname: z.string().trim().default("/"),
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
      max_tokens: 600,
      system: buildAssistantSystemPrompt(language, body.pathname),
      messages: body.messages.map((m): ChatMessage => ({ role: m.role, content: m.content })),
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
