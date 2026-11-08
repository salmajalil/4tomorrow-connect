import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_DOC_LENGTH } from "@/lib/input-limits";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceAiQuota, getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
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
import { streamJsonResponse } from "@/lib/streaming-json-response";
import type { DeliverableKind, DeliverableContent } from "@/types/database";

// Same "one per call, in parallel" fix already proven by DECIDE's scenarios
// route and LEARN's split generation — up to 6 deliverables, each modest
// (no web_search), run concurrently so wall-clock is bounded by the
// slowest one, not their sum.
export const maxDuration = 120;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  sourceDocText: z.string().trim().max(MAX_DOC_LENGTH).default(""),
  // Per-kind guided questionnaire answers, keyed by DeliverableKind — {} for
  // any kind the client didn't answer (the whole "Boost All" one-click path
  // keeps working with this entirely omitted).
  inputs: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to generate the deliverables." : "Connecte-toi pour générer les livrables." },
      { status: 401 }
    );
  }

  // Daily AI quota per user and route (see assertAiQuota, src/lib/anthropic.ts).
  const quotaResponse = await enforceAiQuota(supabase, user.id, "deliver/boost-all", language);
  if (quotaResponse) return quotaResponse;

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

  const anthropic = getAnthropicClient();

  // The slow part (up to 6 parallel AI calls, then the save) — wrapped so
  // the connection stays visibly alive throughout instead of one long
  // silent wait (see src/lib/streaming-json-response.ts). Thrown errors
  // below become the same { error } body callers already expect.
  return streamJsonResponse(async () => {
    const settled = await Promise.allSettled(
      missingKinds.map(async (kind) => {
        const kindInputs = body.inputs[kind] ?? {};
        const userPrompt = buildDeliverableUserPrompt(
          { ...mission.context, sourceDocText: body.sourceDocText || undefined },
          kind,
          kindInputs
        );
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
        return { kind, title: result.title, content: result.content, inputs: kindInputs };
      })
    );

    const succeeded = settled
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          kind: DeliverableKind;
          title: string;
          content: DeliverableContent;
          inputs: Record<string, string>;
        }> => r.status === "fulfilled"
      )
      .map((r) => r.value);

    if (succeeded.length === 0) {
      const firstError = settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
      if (firstError instanceof Anthropic.APIError) {
        throw new Error(
          language === "en"
            ? "The deliverables engine couldn't respond. Try again in a moment."
            : "Le moteur de livrables n'a pas pu répondre. Réessaie dans un instant."
        );
      }
      if (firstError instanceof DeliverParseError) throw new Error(firstError.message);
      throw new Error(
        language === "en"
          ? "The deliverables engine took too long to respond. Try again."
          : "Le moteur de livrables a mis trop de temps à répondre. Réessaie."
      );
    }

    const totalReady = existingKinds.size + succeeded.length;
    const [{ data: inserted }] = await Promise.all([
      supabase
        .from("deliverables")
        .upsert(
          succeeded.map((s) => ({
            transformation_id: mission.transformationId,
            trajectory_id: mission.trajectoryId,
            kind: s.kind,
            title: s.title,
            content: s.content,
            inputs: s.inputs,
          })),
          { onConflict: "transformation_id,trajectory_id,kind" }
        )
        .select("*"),
      setModuleStatus(supabase, mission.transformationId, "deliver", totalReady >= DELIVERABLE_KINDS.length ? "done" : "in_progress"),
    ]);

    return {
      deliverables: inserted ?? [],
      ...(succeeded.length < missingKinds.length
        ? {
            warning:
              language === "en"
                ? `${succeeded.length}/${missingKinds.length} missing deliverable(s) generated — the others failed, retry them individually.`
                : `${succeeded.length}/${missingKinds.length} livrable(s) manquant(s) généré(s) — les autres ont échoué, réessaie individuellement.`,
          }
        : {}),
    };
  });
}
