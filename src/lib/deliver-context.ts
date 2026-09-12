import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TrajectoryIndicators } from "@/types/database";
import type { Domain } from "@/lib/decide";
import type { DeliverGenerationContext } from "@/lib/deliver";

// Same flattening as src/app/api/decide/roadmap/route.ts's helper — the
// prompt just needs human-readable indicator text, not the
// {value, confidence} structure. Kept as a local copy rather than a shared
// export, matching this codebase's existing convention (each module's
// parse/format helpers are duplicated in miniature rather than centralized
// — see extractJson in decide.ts vs learn.ts).
function flattenIndicators(indicators: TrajectoryIndicators): Record<string, string> {
  return Object.fromEntries(
    Object.entries(indicators).map(([key, entry]) => [
      key,
      entry.value === null ? "non estimé" : `${entry.value} (${entry.confidence})`,
    ])
  );
}

export type DeliverMissionContext = {
  transformationId: string;
  trajectoryId: string;
  context: DeliverGenerationContext;
  phaseNames: string[];
};

// Shared "is a trajectory chosen, load everything needed to generate or
// recalibrate" lookup used by every Deliver route. Returns null when no
// trajectory has been selected yet in Decide — callers 404 rather than
// duplicate Decide's own generation logic, per the brief's DECIDE/DELIVER
// boundary ("DELIVER ne régénère pas une nouvelle roadmap de zéro").
export async function loadMissionContext(
  supabase: SupabaseClient<Database>,
  transformationId: string
): Promise<DeliverMissionContext | null> {
  const { data: transformation } = await supabase
    .from("transformations")
    .select("id, organization_id, challenges, objectives, domains, selected_trajectory_id")
    .eq("id", transformationId)
    .maybeSingle();

  if (!transformation || !transformation.selected_trajectory_id) return null;

  const [{ data: trajectory }, { data: org }, { data: gaps }, { data: priorities }, { data: phases }] = await Promise.all([
    supabase
      .from("trajectories")
      .select("id, name, stance, description, executive_briefing, tech_stack, indicators")
      .eq("id", transformation.selected_trajectory_id)
      .maybeSingle(),
    supabase.from("organizations").select("name, industry").eq("id", transformation.organization_id).maybeSingle(),
    supabase.from("gaps").select("name, reason").eq("transformation_id", transformationId),
    supabase.from("priorities").select("name, reason").eq("transformation_id", transformationId),
    supabase
      .from("roadmap_phases")
      .select("phase_name")
      .eq("trajectory_id", transformation.selected_trajectory_id)
      .order("order_index"),
  ]);

  if (!trajectory) return null;

  return {
    transformationId,
    trajectoryId: trajectory.id,
    context: {
      domains: (transformation.domains as Domain[]) ?? [],
      organization: org?.name ?? "",
      industry: org?.industry ?? "",
      challenges: transformation.challenges ?? "",
      objectives: transformation.objectives ?? "",
      trajectoryName: trajectory.name,
      trajectoryStance: trajectory.stance ?? "",
      trajectoryDescription: trajectory.description ?? "",
      executiveBriefing: trajectory.executive_briefing ?? "",
      techStack: (trajectory.tech_stack as { name: string; detail?: string; benefit?: string }[]) ?? [],
      indicators: flattenIndicators((trajectory.indicators as TrajectoryIndicators) ?? {}),
      gaps: (gaps ?? []).map((g) => ({ name: g.name, reason: g.reason ?? "" })),
      priorities: (priorities ?? []).map((p) => ({ name: p.name, reason: p.reason ?? "" })),
    },
    phaseNames: (phases ?? []).map((p) => p.phase_name),
  };
}
