import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildRecalibrationSystemPrompt,
  buildRecalibrationUserPrompt,
  parseRecalibrationOutput,
  DeliverParseError,
} from "@/lib/deliver";
import { loadMissionContext } from "@/lib/deliver-context";
import { getLanguage } from "@/lib/i18n/language";

export const maxDuration = 60;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  feedbackText: z.string().trim().min(1, "Décris l'avancement réel avant d'envoyer."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour envoyer un feedback." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  const mission = await loadMissionContext(supabase, body.transformationId);
  if (!mission) {
    return NextResponse.json({ error: "Aucune trajectoire choisie pour ce projet." }, { status: 404 });
  }

  const language = await getLanguage();
  const anthropic = getAnthropicClient();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 3000,
      system: buildRecalibrationSystemPrompt(language),
      messages: [
        {
          role: "user",
          content: buildRecalibrationUserPrompt({
            ...mission.context,
            feedbackText: body.feedbackText,
            phaseNames: mission.phaseNames,
          }),
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
      const detail = `${err.status ?? "réseau"} — ${err.message ?? "erreur inconnue"}`.slice(0, 200);
      return NextResponse.json(
        { error: `Le moteur de recalibration n'a pas pu répondre (${detail}). Réessaie.` },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Le moteur de recalibration a mis trop de temps à répondre. Réessaie." },
      { status: 504 }
    );
  }

  let summary;
  try {
    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    summary = parseRecalibrationOutput(rawText);
  } catch (err) {
    if (err instanceof DeliverParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const { data: feedback, error: insertError } = await supabase
    .from("mission_feedback")
    .insert({
      transformation_id: mission.transformationId,
      trajectory_id: mission.trajectoryId,
      feedback_text: body.feedbackText,
      ai_summary: summary,
    })
    .select("*")
    .single();

  if (insertError || !feedback) {
    return NextResponse.json({ error: "Impossible d'enregistrer le feedback. Réessaie." }, { status: 500 });
  }

  return NextResponse.json({ feedback });
}
