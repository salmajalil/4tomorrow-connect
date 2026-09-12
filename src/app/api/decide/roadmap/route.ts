import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
  parseRoadmapOutput,
  DecideParseError,
  type Domain,
} from "@/lib/decide";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";
import type { TrajectoryIndicators } from "@/types/database";

// The roadmap prompt just needs human-readable indicator text, not the
// {value, confidence} structure scenario generation stores — flatten it
// here rather than teaching the roadmap prompt builder about confidence.
function flattenIndicators(indicators: TrajectoryIndicators): Record<string, string> {
  return Object.fromEntries(
    Object.entries(indicators).map(([key, entry]) => [
      key,
      entry.value === null ? "non estimé" : `${entry.value} (${entry.confidence})`,
    ])
  );
}

// No web_search, but max_tokens was raised to 4500 to stop truncated JSON
// (see the max_tokens comment below) — a 60s ceiling then genuinely got hit
// in production (FUNCTION_INVOCATION_TIMEOUT), not just as a safety net.
export const maxDuration = 120;

const requestSchema = z.object({
  trajectoryId: z.string().uuid("Scénario invalide."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de démarrage invalide."),
  priorityCost: z.number().min(0).max(100),
  priorityCo2: z.number().min(0).max(100),
  priorityRisk: z.number().min(0).max(100),
  prioritySpeed: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour générer une roadmap." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  const { data: trajectory, error: trajectoryError } = await supabase
    .from("trajectories")
    .select("id, transformation_id, name, stance, description, indicators")
    .eq("id", body.trajectoryId)
    .maybeSingle();

  if (trajectoryError || !trajectory) {
    return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });
  }

  const { data: transformation } = await supabase
    .from("transformations")
    .select("domains")
    .eq("id", trajectory.transformation_id)
    .maybeSingle();

  const language = await getLanguage();
  const anthropic = getAnthropicClient();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      // 3000 was truncating mid-JSON before the closing <RESULT_JSON> tag —
      // same root cause as the scenarios route: 3-5 phases each with up to
      // 6 deliverables, 6 actions and 4 KPIs (every one a full, specific
      // sentence per the "never generic" rule) adds up past that budget.
      max_tokens: 4500,
      system: buildRoadmapSystemPrompt(language),
      messages: [
        {
          role: "user",
          content: buildRoadmapUserPrompt({
            domains: (transformation?.domains as Domain[]) ?? [],
            scenarioName: trajectory.name,
            scenarioStance: trajectory.stance ?? "",
            scenarioDescription: trajectory.description ?? "",
            indicators: flattenIndicators((trajectory.indicators as TrajectoryIndicators) ?? {}),
            priorityCost: body.priorityCost,
            priorityCo2OrEquivalent: body.priorityCo2,
            priorityRisk: body.priorityRisk,
            prioritySpeed: body.prioritySpeed,
          }),
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
      return NextResponse.json(
        { error: "Le moteur de roadmap n'a pas pu répondre. Réessaie dans un instant." },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Le moteur de roadmap a mis trop de temps à répondre. Réessaie." },
      { status: 504 }
    );
  }

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let result;
  try {
    result = parseRoadmapOutput(rawText);
  } catch (err) {
    if (err instanceof DecideParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  // Compute real calendar dates server-side (never trust the model's own
  // date arithmetic) by accumulating each phase's duration sequentially
  // from the chosen start date.
  let cursor = new Date(`${body.startDate}T00:00:00Z`);
  const phasesWithDates = result.phases.map((phase, index) => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + phase.durationWeeks * 7);
    cursor = new Date(end);
    return {
      transformation_id: trajectory.transformation_id,
      trajectory_id: trajectory.id,
      phase_name: phase.name,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      deliverables: phase.deliverables,
      actions: phase.actions,
      kpis: phase.kpis,
      order_index: index,
    };
  });

  // Support "Regenerate roadmap": clear this scenario's previous phases first.
  await supabase.from("roadmap_phases").delete().eq("trajectory_id", trajectory.id);
  const { data: inserted, error: insertError } = await supabase
    .from("roadmap_phases")
    .insert(phasesWithDates)
    .select("*");

  if (insertError) {
    return NextResponse.json({ error: "Impossible d'enregistrer la roadmap. Réessaie." }, { status: 500 });
  }

  await supabase
    .from("trajectories")
    .update({
      roadmap_start_date: body.startDate,
      priority_cost: body.priorityCost,
      priority_co2: body.priorityCo2,
      priority_risk: body.priorityRisk,
      priority_speed: body.prioritySpeed,
    })
    .eq("id", trajectory.id);

  await setModuleStatus(supabase, trajectory.transformation_id, "decide", "done");

  return NextResponse.json({ phases: inserted ?? phasesWithDates });
}
