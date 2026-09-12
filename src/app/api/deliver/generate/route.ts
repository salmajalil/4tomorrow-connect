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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour générer un livrable." }, { status: 401 });
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
    return NextResponse.json(
      { error: "Aucune trajectoire choisie pour ce projet — sélectionne un scénario dans Decide avant de générer des livrables." },
      { status: 404 }
    );
  }

  const language = await getLanguage();
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
    return handleAnthropicError(err);
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
    return NextResponse.json({ error: "Impossible d'enregistrer le livrable. Réessaie." }, { status: 500 });
  }

  await setModuleStatus(supabase, mission.transformationId, "deliver", "in_progress");

  return NextResponse.json({ deliverable });
}

function handleAnthropicError(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
    const detail = `${err.status ?? "réseau"} — ${err.message ?? "erreur inconnue"}`.slice(0, 200);
    return NextResponse.json(
      { error: `Le moteur de livrables n'a pas pu répondre (${detail}). Réessaie dans un instant.` },
      { status }
    );
  }
  return NextResponse.json(
    { error: "Le moteur de livrables a mis trop de temps à répondre. Réessaie." },
    { status: 504 }
  );
}
