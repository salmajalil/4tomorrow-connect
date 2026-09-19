import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildDeliverableSystemPrompt,
  buildDeliverableUserPrompt,
  parseDeliverableOutput,
  DeliverParseError,
  DELIVERABLE_KINDS,
} from "@/lib/deliver";
import { loadMissionContext } from "@/lib/deliver-context";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";

export const maxDuration = 60;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  kind: z.enum(DELIVERABLE_KINDS),
  sourceDocText: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to generate a deliverable." : "Connecte-toi pour générer un livrable." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const mission = await loadMissionContext(supabase, body.transformationId);
  if (!mission) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "No trajectory chosen for this project — select a scenario in Decide before generating deliverables."
            : "Aucune trajectoire choisie pour ce projet — sélectionne un scénario dans Decide avant de générer des livrables.",
      },
      { status: 404 }
    );
  }

  const anthropic = getAnthropicClient();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 4000,
      system: buildDeliverableSystemPrompt(body.kind, language),
      messages: [
        { role: "user", content: buildDeliverableUserPrompt({ ...mission.context, sourceDocText: body.sourceDocText || undefined }) },
      ],
    });
  } catch (err) {
    return handleAnthropicError(err, language);
  }

  let result;
  try {
    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    result = parseDeliverableOutput(body.kind, rawText);
  } catch (err) {
    if (err instanceof DeliverParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const { data: deliverable, error: insertError } = await supabase
    .from("deliverables")
    .upsert(
      {
        transformation_id: mission.transformationId,
        trajectory_id: mission.trajectoryId,
        kind: body.kind,
        title: result.title,
        content: result.content,
      },
      { onConflict: "transformation_id,trajectory_id,kind" }
    )
    .select("*")
    .single();

  if (insertError || !deliverable) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't save the deliverable. Try again." : "Impossible d'enregistrer le livrable. Réessaie." },
      { status: 500 }
    );
  }

  await setModuleStatus(supabase, mission.transformationId, "deliver", "in_progress");

  return NextResponse.json({ deliverable });
}

function handleAnthropicError(err: unknown, language: "fr" | "en") {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
    const detail =
      language === "en"
        ? `${err.status ?? "network"} — ${err.message ?? "unknown error"}`.slice(0, 200)
        : `${err.status ?? "réseau"} — ${err.message ?? "erreur inconnue"}`.slice(0, 200);
    return NextResponse.json(
      {
        error:
          language === "en"
            ? `The deliverables engine couldn't respond (${detail}). Try again in a moment.`
            : `Le moteur de livrables n'a pas pu répondre (${detail}). Réessaie dans un instant.`,
      },
      { status }
    );
  }
  return NextResponse.json(
    {
      error:
        language === "en"
          ? "The deliverables engine took too long to respond. Try again."
          : "Le moteur de livrables a mis trop de temps à répondre. Réessaie.",
    },
    { status: 504 }
  );
}
