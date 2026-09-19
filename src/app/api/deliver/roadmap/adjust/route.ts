import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildRoadmapAdjustSystemPrompt,
  buildRoadmapAdjustUserPrompt,
  parseRoadmapAdjustOutput,
  DeliverParseError,
} from "@/lib/deliver";
import { loadMissionContext } from "@/lib/deliver-context";
import { getLanguage } from "@/lib/i18n/language";

export const maxDuration = 60;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  priorityCost: z.number().min(0).max(100),
  priorityCo2: z.number().min(0).max(100),
  priorityRisk: z.number().min(0).max(100),
  prioritySpeed: z.number().min(0).max(100),
});

// "Regenerate" in Deliver's execution Gantt — refreshes only phases still
// marked "upcoming", leaving in_progress/done phases (and their actual
// dates) exactly as they are. This is intentionally a different endpoint
// from /api/decide/roadmap, which deletes and recreates every phase — that
// behavior is correct for Decide (comparing scenarios pre-execution) and
// wrong for Deliver (an execution already underway).
export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in." : "Connecte-toi." }, { status: 401 });
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
      { error: language === "en" ? "No trajectory chosen for this project." : "Aucune trajectoire choisie pour ce projet." },
      { status: 404 }
    );
  }

  const { data: phases } = await supabase
    .from("roadmap_phases")
    .select("*")
    .eq("trajectory_id", mission.trajectoryId)
    .order("order_index");

  if (!phases || phases.length === 0) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "No roadmap to adjust — generate a roadmap in Decide first."
            : "Aucune roadmap à ajuster — génère d'abord une roadmap dans Decide.",
      },
      { status: 404 }
    );
  }

  const fixed = phases.filter((p) => p.execution_status !== "upcoming");
  const upcoming = phases.filter((p) => p.execution_status === "upcoming");

  if (upcoming.length === 0) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "All phases are already in progress or done — nothing to adjust."
            : "Toutes les phases sont déjà en cours ou terminées — rien à réajuster.",
      },
      { status: 400 }
    );
  }

  const anthropic = getAnthropicClient();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 4000,
      system: buildRoadmapAdjustSystemPrompt(language),
      messages: [
        {
          role: "user",
          content: buildRoadmapAdjustUserPrompt({
            ...mission.context,
            completedPhases: fixed.map((p) => ({ name: p.phase_name, endDate: p.actual_end_date ?? p.end_date })),
            remainingPhaseNames: upcoming.map((p) => p.phase_name),
            priorityCost: body.priorityCost,
            priorityCo2: body.priorityCo2,
            priorityRisk: body.priorityRisk,
            prioritySpeed: body.prioritySpeed,
          }),
        },
      ],
    });
  } catch (err) {
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
              ? `The roadmap engine couldn't respond (${detail}). Try again.`
              : `Le moteur de roadmap n'a pas pu répondre (${detail}). Réessaie.`,
        },
        { status }
      );
    }
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "The roadmap engine took too long to respond. Try again."
            : "Le moteur de roadmap a mis trop de temps à répondre. Réessaie.",
      },
      { status: 504 }
    );
  }

  let result;
  try {
    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    result = parseRoadmapAdjustOutput(rawText);
  } catch (err) {
    if (err instanceof DeliverParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  // Anchor the new phases right after the last fixed (already-executing or
  // done) phase, or today if execution hasn't actually started yet — never
  // trust the model's own date arithmetic, same as Decide's roadmap route.
  const lastFixed = fixed.length > 0 ? fixed[fixed.length - 1] : null;
  const anchorSource = lastFixed ? (lastFixed.actual_end_date ?? lastFixed.end_date) : null;
  let cursor = anchorSource ? new Date(`${anchorSource}T00:00:00Z`) : new Date();
  const nextOrderIndex = fixed.length;
  const newPhaseRows = result.phases.map((phase, i) => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + phase.durationWeeks * 7);
    cursor = new Date(end);
    return {
      transformation_id: mission.transformationId,
      trajectory_id: mission.trajectoryId,
      phase_name: phase.name,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      deliverables: phase.deliverables,
      actions: phase.actions,
      kpis: phase.kpis,
      order_index: nextOrderIndex + i,
    };
  });

  await supabase.from("roadmap_phases").delete().in("id", upcoming.map((p) => p.id));
  const { data: inserted, error: insertError } = await supabase.from("roadmap_phases").insert(newPhaseRows).select("*");

  if (insertError) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't save the adjusted phases. Try again."
            : "Impossible d'enregistrer les phases ajustées. Réessaie.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ phases: [...fixed, ...(inserted ?? newPhaseRows)] });
}
