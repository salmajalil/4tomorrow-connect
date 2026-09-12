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
import type { DeliverableKind, DeliverableContent } from "@/types/database";

// Same "one per call, in parallel" fix already proven by DECIDE's scenarios
// route and LEARN's split generation — up to 6 deliverables, each modest
// (no web_search), run concurrently so wall-clock is bounded by the
// slowest one, not their sum.
export const maxDuration = 120;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  sourceDocText: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour générer les livrables." }, { status: 401 });
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

  const { data: existing } = await supabase
    .from("deliverables")
    .select("kind")
    .eq("transformation_id", mission.transformationId)
    .eq("trajectory_id", mission.trajectoryId);
  const existingKinds = new Set((existing ?? []).map((d) => d.kind));
  const missingKinds = DELIVERABLE_KINDS.filter((k) => !existingKinds.has(k));

  if (missingKinds.length === 0) {
    return NextResponse.json({ deliverables: [], alreadyComplete: true });
  }

  const language = await getLanguage();
  const anthropic = getAnthropicClient();
  const userPrompt = buildDeliverableUserPrompt({ ...mission.context, sourceDocText: body.sourceDocText || undefined });

  const settled = await Promise.allSettled(
    missingKinds.map(async (kind) => {
      const createCall = () =>
        anthropic.messages.create({
          model: MATCHING_MODEL,
          max_tokens: 4000,
          system: buildDeliverableSystemPrompt(kind, language),
          messages: [{ role: "user", content: userPrompt }],
        });

      let response;
      try {
        response = await createCall();
      } catch (err) {
        if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          response = await createCall();
        } else {
          throw err;
        }
      }

      const rawText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const result = parseDeliverableOutput(kind, rawText);
      return { kind, title: result.title, content: result.content };
    })
  );

  const succeeded = settled
    .filter(
      (r): r is PromiseFulfilledResult<{ kind: DeliverableKind; title: string; content: DeliverableContent }> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);

  if (succeeded.length === 0) {
    const firstError = settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
    if (firstError instanceof Anthropic.APIError) {
      const status = firstError.status === 401 || firstError.status === 403 ? 502 : (firstError.status ?? 502);
      return NextResponse.json(
        { error: "Le moteur de livrables n'a pas pu répondre. Réessaie dans un instant." },
        { status }
      );
    }
    if (firstError instanceof DeliverParseError) {
      return NextResponse.json({ error: firstError.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Le moteur de livrables a mis trop de temps à répondre. Réessaie." },
      { status: 504 }
    );
  }

  const { data: inserted } = await supabase
    .from("deliverables")
    .upsert(
      succeeded.map((s) => ({
        transformation_id: mission.transformationId,
        trajectory_id: mission.trajectoryId,
        kind: s.kind,
        title: s.title,
        content: s.content,
      })),
      { onConflict: "transformation_id,trajectory_id,kind" }
    )
    .select("*");

  const totalReady = existingKinds.size + succeeded.length;
  await setModuleStatus(
    supabase,
    mission.transformationId,
    "deliver",
    totalReady >= DELIVERABLE_KINDS.length ? "done" : "in_progress"
  );

  return NextResponse.json({
    deliverables: inserted ?? [],
    ...(succeeded.length < missingKinds.length
      ? {
          warning: `${succeeded.length}/${missingKinds.length} livrable(s) manquant(s) généré(s) — les autres ont échoué, réessaie individuellement.`,
        }
      : {}),
  });
}
