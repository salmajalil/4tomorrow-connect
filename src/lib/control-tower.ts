import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ModuleName,
  ModuleStatusValue,
  RecommendableModule,
  ModuleRelevance,
} from "@/types/database";

export const MODULE_ORDER: ModuleName[] = ["decide", "connect", "learn", "deliver"];

export type ControlTowerProject = {
  transformationId: string;
  title: string;
  organizationName: string;
  domains: string[];
  createdAt: string;
  moduleStatus: Record<ModuleName, ModuleStatusValue>;
  moduleRecommendations: { module: RecommendableModule; relevance: ModuleRelevance; reason: string | null }[];
  priorities: { name: string; reason: string | null }[];
  risks: { id: string; name: string; reason: string | null }[];
  opportunities: { id: string; name: string; reason: string | null }[];
  keyMetrics: { key: string; value: string | number }[];
  pendingValidationCount: number;
  matchesCount: number;
  progressPercent: number; // modules done / 4
  targetDate: string | null; // furthest roadmap_phases.end_date, if a roadmap exists
};

// One aggregate fetch, called both for the initial server render and again
// on the client after any Realtime event — small dataset (a single user's
// projects), so a full re-fetch is simpler and safer than patching state
// incrementally per event type.
export async function fetchControlTowerProjects(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ControlTowerProject[]> {
  const { data: orgs } = await supabase.from("organizations").select("id, name").eq("owner_id", userId);
  const orgIds = (orgs ?? []).map((o) => o.id);
  if (orgIds.length === 0) return [];
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const { data: transformations } = await supabase
    .from("transformations")
    .select("id, organization_id, challenges, objectives, domains, created_at")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });

  if (!transformations || transformations.length === 0) return [];
  const txIds = transformations.map((t) => t.id);

  const [
    { data: statuses },
    { data: recommendations },
    { data: priorities },
    { data: risks },
    { data: opportunities },
    { data: trajectories },
    { data: matches },
    { data: roadmapPhases },
  ] = await Promise.all([
    supabase.from("module_status").select("transformation_id, module, status").in("transformation_id", txIds),
    supabase
      .from("module_recommendations")
      .select("transformation_id, module, relevance, reason")
      .in("transformation_id", txIds),
    supabase.from("priorities").select("transformation_id, name, reason").in("transformation_id", txIds),
    supabase.from("risks").select("id, transformation_id, name, reason").in("transformation_id", txIds),
    supabase
      .from("opportunities")
      .select("id, transformation_id, name, reason")
      .in("transformation_id", txIds),
    supabase.from("trajectories").select("transformation_id, indicators").in("transformation_id", txIds),
    supabase.from("matches").select("id, transformation_id").in("transformation_id", txIds),
    supabase.from("roadmap_phases").select("transformation_id, end_date").in("transformation_id", txIds),
  ]);

  return transformations.map((t) => {
    const moduleStatus = Object.fromEntries(MODULE_ORDER.map((m) => [m, "not_started" as ModuleStatusValue])) as Record<
      ModuleName,
      ModuleStatusValue
    >;
    for (const s of statuses ?? []) {
      if (s.transformation_id === t.id) moduleStatus[s.module] = s.status;
    }

    const keyMetrics: { key: string; value: string | number }[] = [];
    let pendingValidationCount = 0;
    for (const traj of trajectories ?? []) {
      if (traj.transformation_id !== t.id) continue;
      for (const [key, entry] of Object.entries(traj.indicators ?? {})) {
        if (entry.confidence === "verified") {
          if (!keyMetrics.some((m) => m.key === key)) keyMetrics.push({ key, value: entry.value ?? "—" });
        } else {
          pendingValidationCount += 1;
        }
      }
    }

    const progressPercent = Math.round(
      (MODULE_ORDER.filter((m) => moduleStatus[m] === "done").length / MODULE_ORDER.length) * 100
    );

    const targetDate = (roadmapPhases ?? [])
      .filter((r) => r.transformation_id === t.id)
      .reduce<string | null>((max, r) => (!max || r.end_date > max ? r.end_date : max), null);

    const title = t.challenges?.trim()
      ? t.challenges.trim().slice(0, 72) + (t.challenges.trim().length > 72 ? "…" : "")
      : t.objectives?.trim()
        ? t.objectives.trim().slice(0, 72)
        : orgNameById.get(t.organization_id) || "Projet sans titre";

    return {
      transformationId: t.id,
      title,
      organizationName: orgNameById.get(t.organization_id) ?? "",
      domains: (t.domains as string[]) ?? [],
      createdAt: t.created_at,
      moduleStatus,
      moduleRecommendations: (recommendations ?? [])
        .filter((r) => r.transformation_id === t.id)
        .map((r) => ({ module: r.module, relevance: r.relevance, reason: r.reason })),
      priorities: (priorities ?? []).filter((p) => p.transformation_id === t.id),
      risks: (risks ?? []).filter((r) => r.transformation_id === t.id),
      opportunities: (opportunities ?? []).filter((o) => o.transformation_id === t.id),
      keyMetrics,
      pendingValidationCount,
      matchesCount: (matches ?? []).filter((m) => m.transformation_id === t.id).length,
      progressPercent,
      targetDate,
    };
  });
}
