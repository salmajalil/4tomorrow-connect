import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { TrajectoryIndicators } from "@/types/database";

// Lets a user skip Decide entirely and start Deliver from the Diagnostic
// Assessment wizard filled in directly here — creates the same shape
// Decide would have produced (a transformation with a selected trajectory)
// so the rest of Deliver (deliver-context.ts's loadMissionContext,
// generation routes) works completely unchanged. The wizard's structured
// answers are folded into transformations.constraints as human-readable
// text (same "structured context as free text" trick as Decide's own
// intake form) rather than given dedicated columns — Deliver's
// InputsTab already renders/edits that field as-is.
export const maxDuration = 30;

const objectiveKeySchema = z.enum([
  "costReduction",
  "operationalExcellence",
  "digitalTransformation",
  "technicalTransformation",
  "sustainability",
  "growth",
  "resilience",
]);

const requestSchema = z.object({
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  scope: z.string().trim().default(""),
  currentState: z.string().trim().default(""),
  targetState: z.string().trim().default(""),
  primaryObjective: objectiveKeySchema.nullable().default(null),
  secondaryObjectives: z.array(objectiveKeySchema).default([]),
  timelineHorizon: z.enum(["3to6", "6to12", "12to18", "18to36", "36plus"]).nullable().default(null),
  scaleOfOperations: z.enum(["singleSite", "regional", "national", "global"]).nullable().default(null),
  digitalMaturity: z.enum(["low", "medium", "high"]).nullable().default(null),
  assetCriticality: z.enum(["low", "medium", "high", "critical"]).nullable().default(null),
  regulatoryPressure: z.enum(["low", "medium", "high"]).nullable().default(null),
  kpis: z.array(z.string().trim().min(1)).default([]),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to start a project." : "Connecte-toi pour démarrer un projet." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  if (!body.scope && !body.currentState && !body.targetState && !body.primaryObjective) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Describe at least the scope, current state, or objective to get started."
            : "Décris au moins le périmètre, l'état actuel ou l'objectif pour démarrer.",
      },
      { status: 400 }
    );
  }

  const w = getDictionary(language).deliver.wizard;

  const objectiveLabel: Record<z.infer<typeof objectiveKeySchema>, string> = {
    costReduction: w.objectiveCostReduction,
    operationalExcellence: w.objectiveOperationalExcellence,
    digitalTransformation: w.objectiveDigitalTransformation,
    technicalTransformation: w.objectiveTechnicalTransformation,
    sustainability: w.objectiveSustainability,
    growth: w.objectiveGrowth,
    resilience: w.objectiveResilience,
  };
  const timelineLabel: Record<NonNullable<typeof body.timelineHorizon>, string> = {
    "3to6": w.timeline3to6,
    "6to12": w.timeline6to12,
    "12to18": w.timeline12to18,
    "18to36": w.timeline18to36,
    "36plus": w.timeline36plus,
  };
  const scaleLabel: Record<NonNullable<typeof body.scaleOfOperations>, string> = {
    singleSite: w.scaleSingleSite,
    regional: w.scaleRegional,
    national: w.scaleNational,
    global: w.scaleGlobal,
  };
  const levelLabel: Record<"low" | "medium" | "high" | "critical", string> = {
    low: w.levelLow,
    medium: w.levelMedium,
    high: w.levelHigh,
    critical: w.levelCritical,
  };

  const constraintsLines: string[] = [];
  if (body.scope) constraintsLines.push(`${w.scopeLabel} : ${body.scope}`);
  if (body.currentState) constraintsLines.push(`${w.currentStateLabel} : ${body.currentState}`);
  if (body.targetState) constraintsLines.push(`${w.targetStateLabel} : ${body.targetState}`);
  if (body.primaryObjective) constraintsLines.push(`${w.primaryObjectiveLabel} : ${objectiveLabel[body.primaryObjective]}`);
  if (body.secondaryObjectives.length > 0) {
    constraintsLines.push(
      `${w.secondaryObjectivesLabel} : ${body.secondaryObjectives.map((k) => objectiveLabel[k]).join(", ")}`
    );
  }
  if (body.timelineHorizon) constraintsLines.push(`${w.timelineLabel} : ${timelineLabel[body.timelineHorizon]}`);
  if (body.scaleOfOperations) constraintsLines.push(`${w.scaleLabel} : ${scaleLabel[body.scaleOfOperations]}`);
  if (body.digitalMaturity) constraintsLines.push(`${w.maturityLabel} : ${levelLabel[body.digitalMaturity]}`);
  if (body.assetCriticality) constraintsLines.push(`${w.criticalityLabel} : ${levelLabel[body.assetCriticality]}`);
  if (body.regulatoryPressure) constraintsLines.push(`${w.regulatoryLabel} : ${levelLabel[body.regulatoryPressure]}`);
  const constraints = constraintsLines.join("\n");

  // Same "one organization per user" reuse pattern as /api/decide/diagnostic.
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data: newOrg, error: orgError } = await supabase
      .from("organizations")
      .insert({
        owner_id: user.id,
        name: body.organization || body.industry || "Mon organisation",
        industry: body.industry || null,
      })
      .select("id")
      .single();
    if (orgError || !newOrg) {
      return NextResponse.json(
        { error: language === "en" ? "Couldn't create the project. Try again." : "Impossible de créer le projet. Réessaie." },
        { status: 500 }
      );
    }
    organizationId = newOrg.id;
  }

  const { data: transformation, error: transformationError } = await supabase
    .from("transformations")
    .insert({
      organization_id: organizationId,
      challenges: body.currentState || body.scope || null,
      objectives: body.targetState || null,
      constraints: constraints || null,
      status: "active",
    })
    .select("id")
    .single();

  if (transformationError || !transformation) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't create the project. Try again." : "Impossible de créer le projet. Réessaie." },
      { status: 500 }
    );
  }

  const transformationId: string = transformation.id;
  const trajectoryName =
    body.scope.slice(0, 72) || body.targetState.slice(0, 72) || body.organization || "Projet";
  const trajectoryStance = body.primaryObjective ? objectiveLabel[body.primaryObjective] : w.title;
  const indicators: TrajectoryIndicators = Object.fromEntries(
    body.kpis.map((kpi) => [kpi, { value: null, confidence: "unknown" as const }])
  );

  const { data: trajectory, error: trajectoryError } = await supabase
    .from("trajectories")
    .insert({
      transformation_id: transformationId,
      name: trajectoryName,
      stance: trajectoryStance,
      description: body.targetState || body.currentState,
      indicators,
    })
    .select("id")
    .single();

  if (trajectoryError || !trajectory) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't create the project. Try again." : "Impossible de créer le projet. Réessaie." },
      { status: 500 }
    );
  }

  const { error: linkError } = await supabase
    .from("transformations")
    .update({ selected_trajectory_id: trajectory.id })
    .eq("id", transformationId);

  if (linkError) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't create the project. Try again." : "Impossible de créer le projet. Réessaie." },
      { status: 500 }
    );
  }

  await setModuleStatus(supabase, transformationId, "deliver", "in_progress");

  return NextResponse.json({ transformationId });
}
