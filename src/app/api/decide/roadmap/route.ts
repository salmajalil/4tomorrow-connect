import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceAiQuota, getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
  parseRoadmapOutput,
  DecideParseError,
  type Domain,
} from "@/lib/decide";
import { buildInputsBlock } from "@/lib/deliver";
import { computePhaseDates, fitDurationsToWindow, isIsoDate, weeksBetween } from "@/lib/deliver-gantt-calc";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";
import { streamJsonResponse } from "@/lib/streaming-json-response";
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
  // Guided questionnaire (optional, same fields as Livrer's roadmap
  // deliverable — see INPUT_FIELDS.roadmap in src/lib/deliver.ts). {} keeps
  // the original AI-from-diagnostic path exactly as it was.
  guidedInputs: z.record(z.string(), z.string().max(2000)).default({}),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to generate a roadmap." : "Connecte-toi pour générer une roadmap." },
      { status: 401 }
    );
  }

  // Daily AI quota per user and route (see assertAiQuota, src/lib/anthropic.ts).
  const quotaResponse = await enforceAiQuota(supabase, user.id, "decide/roadmap", language);
  if (quotaResponse) return quotaResponse;

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const { data: trajectory, error: trajectoryError } = await supabase
    .from("trajectories")
    .select("id, transformation_id, name, stance, description, indicators")
    .eq("id", body.trajectoryId)
    .maybeSingle();

  if (trajectoryError || !trajectory) {
    return NextResponse.json(
      { error: language === "en" ? "Scenario not found." : "Scénario introuvable." },
      { status: 404 }
    );
  }

  const { data: transformation } = await supabase
    .from("transformations")
    .select("domains")
    .eq("id", trajectory.transformation_id)
    .maybeSingle();

  // Target end date → whole weeks available, computed here (never by the
  // model). Ignored when absent, invalid or not after the start date.
  const targetEndDate = body.guidedInputs.targetEndDate?.trim() ?? "";
  const availableWeeks = isIsoDate(targetEndDate) ? weeksBetween(body.startDate, targetEndDate) : null;
  // The start date already has its own field on this screen; never let a
  // stale questionnaire copy contradict it in the prompt.
  const guidedInputsBlock = buildInputsBlock(
    "roadmap",
    Object.fromEntries(Object.entries(body.guidedInputs).filter(([key]) => key !== "startDate"))
  );

  const anthropic = getAnthropicClient();

  // The slow part (the AI call, then the roadmap writes) — wrapped so the
  // connection stays visibly alive throughout instead of one long silent
  // wait (see src/lib/streaming-json-response.ts). Thrown errors below
  // become the same { error } body callers already expect.
  return streamJsonResponse(async () => {
    let response;
    try {
      response = await anthropic.messages.create({
        model: MATCHING_MODEL,
        // 3000 was truncating mid-JSON before the closing <RESULT_JSON> tag —
        // same root cause as the scenarios route: 3-5 phases each with up to
        // 6 deliverables, 6 actions and 4 KPIs (every one a full, specific
        // sentence per the "never generic" rule) adds up past that budget.
        // Left as-is rather than trimmed further — same reasoning as
        // diagnostic/scenarios: that's a real, previously-hit truncation
        // floor, not headroom.
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
              guidedInputsBlock,
              availableWeeks,
            }),
          },
        ],
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(
          language === "en"
            ? "The roadmap engine couldn't respond. Try again in a moment."
            : "Le moteur de roadmap n'a pas pu répondre. Réessaie dans un instant."
        );
      }
      throw new Error(
        language === "en"
          ? "The roadmap engine took too long to respond. Try again."
          : "Le moteur de roadmap a mis trop de temps à répondre. Réessaie."
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
      if (err instanceof DecideParseError) throw new Error(err.message);
      throw err;
    }

    // Compute real calendar dates server-side (never trust the model's own
    // date arithmetic) by chaining each phase's duration from the chosen
    // start date. With a target end date, the durations are first scaled to
    // fill exactly the available window (largest-remainder rounding, ≥ 1
    // week per phase) — the model's proposal sets the proportions only.
    const proposed = result.phases.map((p) => p.durationWeeks);
    const durations = (availableWeeks !== null ? fitDurationsToWindow(proposed, availableWeeks) : null) ?? proposed;
    const dates = computePhaseDates(body.startDate, durations);
    const phasesWithDates = result.phases.map((phase, index) => ({
      transformation_id: trajectory.transformation_id,
      trajectory_id: trajectory.id,
      phase_name: phase.name,
      start_date: dates[index].start,
      end_date: dates[index].end,
      deliverables: phase.deliverables,
      actions: phase.actions,
      kpis: phase.kpis,
      order_index: index,
    }));

    // Support "Regenerate roadmap": clear this scenario's previous phases
    // first — must happen before the insert below, so stays sequential.
    await supabase.from("roadmap_phases").delete().eq("trajectory_id", trajectory.id);
    const { data: inserted, error: insertError } = await supabase
      .from("roadmap_phases")
      .insert(phasesWithDates)
      .select("*");

    if (insertError) {
      throw new Error(
        language === "en" ? "Couldn't save the roadmap. Try again." : "Impossible d'enregistrer la roadmap. Réessaie."
      );
    }

    // Independent of each other and of the insert above's result.
    await Promise.all([
      supabase
        .from("trajectories")
        .update({
          roadmap_start_date: body.startDate,
          priority_cost: body.priorityCost,
          priority_co2: body.priorityCo2,
          priority_risk: body.priorityRisk,
          priority_speed: body.prioritySpeed,
        })
        .eq("id", trajectory.id),
      setModuleStatus(supabase, trajectory.transformation_id, "decide", "done"),
    ]);

    return { phases: inserted ?? phasesWithDates };
  });
}
