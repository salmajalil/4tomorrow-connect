import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  IndicatorConfidence,
  ModuleName,
  ModuleStatusValue,
  RoadmapExecutionStatus,
} from "@/types/database";
import { MODULE_ORDER } from "@/lib/control-tower";

// Everything the "Impact" view and the two project reports (CEO one-pager,
// detailed report) need, assembled from rows that already exist — no new
// table, no AI call. All reads go through the signed-in user's Supabase
// client, so RLS keeps a user on their own projects: an id that isn't theirs
// simply comes back as null.

export type ImpactIndicator = {
  label: string;
  value: string | number | null;
  confidence: IndicatorConfidence;
};

export type ImpactPhase = {
  name: string;
  startDate: string;
  endDate: string;
  status: RoadmapExecutionStatus;
  deliverables: string[];
  kpis: string[];
};

export type ImpactModule = {
  module: ModuleName;
  status: ModuleStatusValue;
  // Short, factual counters for the journey strip ("12 partenaires
  // proposés"). Kept as numbers so each surface (page, PDF) words them in
  // its own language.
  counts: Record<string, number>;
};

export type ProjectImpact = {
  transformationId: string;
  title: string;
  organizationName: string;
  industry: string | null;
  domains: string[];
  createdAt: string;
  challenges: string | null;
  objectives: string | null;
  constraints: string | null;
  strategicBrief: string | null;
  startingRecommendation: string | null;
  goodIdeas: string[];
  trajectory: {
    name: string;
    stance: string | null;
    description: string | null;
    executiveBriefing: string | null;
  } | null;
  scenarios: { name: string; stance: string | null; selected: boolean }[];
  // The one figure to lead with, then up to three supporting ones. Verified
  // figures always come first; "unknown" never becomes the headline.
  headline: ImpactIndicator | null;
  keyIndicators: ImpactIndicator[];
  indicators: ImpactIndicator[];
  confidence: Record<IndicatorConfidence, number>;
  modules: ImpactModule[];
  progressPercent: number;
  phases: ImpactPhase[];
  nextMilestone: ImpactPhase | null;
  targetDate: string | null;
  priorities: { name: string; reason: string | null }[];
  risks: { name: string; reason: string | null }[];
  opportunities: { name: string; reason: string | null }[];
  matches: { name: string; category: string; reason: string | null }[];
  trainings: { topic: string; mode: string }[];
  // Hours from the project's creation to its first roadmap — the "72 h"
  // promise, measured on this project rather than asserted. Null until a
  // roadmap exists.
  hoursToRoadmap: number | null;
};

const CONFIDENCE_RANK: Record<IndicatorConfidence, number> = { verified: 0, estimate: 1, unknown: 2 };

export function rankIndicators(indicators: ImpactIndicator[]): ImpactIndicator[] {
  return [...indicators].sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);
}

function projectTitle(
  challenges: string | null,
  objectives: string | null,
  fallback: string,
  max = 90
): string {
  const source = challenges?.trim() || objectives?.trim() || "";
  if (!source) return fallback;
  return source.length > max ? `${source.slice(0, max).trimEnd()}…` : source;
}

export async function fetchProjectImpact(
  supabase: SupabaseClient<Database>,
  transformationId: string,
  untitledProjectLabel = "Projet sans titre"
): Promise<ProjectImpact | null> {
  const { data: tx } = await supabase
    .from("transformations")
    .select(
      "id, organization_id, challenges, objectives, constraints, domains, selected_trajectory_id, strategic_brief, starting_recommendation, good_ideas, created_at"
    )
    .eq("id", transformationId)
    .maybeSingle();
  if (!tx) return null;

  const [
    { data: org },
    { data: trajectories },
    { data: statuses },
    { data: priorities },
    { data: risks },
    { data: opportunities },
    { data: phases },
    { data: matches },
    { data: trainings },
    { data: deliverables },
  ] = await Promise.all([
    supabase.from("organizations").select("name, industry").eq("id", tx.organization_id).maybeSingle(),
    supabase
      .from("trajectories")
      .select("id, name, stance, description, indicators, executive_briefing, created_at")
      .eq("transformation_id", tx.id)
      .order("created_at", { ascending: true }),
    supabase.from("module_status").select("module, status").eq("transformation_id", tx.id),
    supabase.from("priorities").select("name, reason, weight").eq("transformation_id", tx.id),
    supabase.from("risks").select("name, reason").eq("transformation_id", tx.id),
    supabase.from("opportunities").select("name, reason").eq("transformation_id", tx.id),
    supabase
      .from("roadmap_phases")
      .select("phase_name, start_date, end_date, execution_status, deliverables, kpis, order_index, created_at")
      .eq("transformation_id", tx.id)
      .order("order_index", { ascending: true }),
    supabase.from("matches").select("name, category, reason").eq("transformation_id", tx.id),
    supabase.from("trainings").select("topic, mode").eq("transformation_id", tx.id),
    supabase.from("deliverables").select("kind").eq("transformation_id", tx.id),
  ]);

  const selected =
    (trajectories ?? []).find((t) => t.id === tx.selected_trajectory_id) ??
    (trajectories && trajectories.length === 1 ? trajectories[0] : null);

  const indicators: ImpactIndicator[] = Object.entries(selected?.indicators ?? {}).map(([label, entry]) => ({
    label,
    value: entry?.value ?? null,
    confidence: entry?.confidence ?? "unknown",
  }));
  const ranked = rankIndicators(indicators);
  const usable = ranked.filter((i) => i.confidence !== "unknown" && i.value !== null && i.value !== "");
  const headline = usable[0] ?? null;
  const keyIndicators = (usable.length >= 3 ? usable : ranked).slice(0, 3);

  const confidence: Record<IndicatorConfidence, number> = { verified: 0, estimate: 0, unknown: 0 };
  for (const i of indicators) confidence[i.confidence] += 1;

  const statusByModule = Object.fromEntries(MODULE_ORDER.map((m) => [m, "not_started" as ModuleStatusValue])) as Record<
    ModuleName,
    ModuleStatusValue
  >;
  for (const s of statuses ?? []) statusByModule[s.module] = s.status;

  const phaseList: ImpactPhase[] = (phases ?? []).map((p) => ({
    name: p.phase_name,
    startDate: p.start_date,
    endDate: p.end_date,
    status: p.execution_status,
    deliverables: (p.deliverables as string[]) ?? [],
    kpis: (p.kpis as string[]) ?? [],
  }));
  const donePhases = phaseList.filter((p) => p.status === "done").length;

  const modules: ImpactModule[] = MODULE_ORDER.map((module) => {
    const counts: Record<string, number> =
      module === "decide"
        ? { scenarios: trajectories?.length ?? 0, priorities: priorities?.length ?? 0 }
        : module === "connect"
          ? { matches: matches?.length ?? 0 }
          : module === "learn"
            ? { trainings: trainings?.length ?? 0 }
            : { phases: phaseList.length, phasesDone: donePhases, deliverables: deliverables?.length ?? 0 };
    return { module, status: statusByModule[module], counts };
  });

  const progressPercent = Math.round(
    (MODULE_ORDER.filter((m) => statusByModule[m] === "done").length / MODULE_ORDER.length) * 100
  );

  const nextMilestone =
    phaseList.find((p) => p.status === "in_progress") ?? phaseList.find((p) => p.status === "upcoming") ?? null;
  const targetDate = phaseList.reduce<string | null>((max, p) => (!max || p.endDate > max ? p.endDate : max), null);

  const firstRoadmapAt = (phases ?? []).reduce<string | null>(
    (min, p) => (!min || p.created_at < min ? p.created_at : min),
    null
  );
  const hoursToRoadmap = firstRoadmapAt
    ? Math.max(1, Math.round((Date.parse(firstRoadmapAt) - Date.parse(tx.created_at)) / 3_600_000))
    : null;

  return {
    transformationId: tx.id,
    title: projectTitle(tx.challenges, tx.objectives, org?.name || untitledProjectLabel),
    organizationName: org?.name ?? "",
    industry: org?.industry ?? null,
    domains: (tx.domains as string[]) ?? [],
    createdAt: tx.created_at,
    challenges: tx.challenges,
    objectives: tx.objectives,
    constraints: tx.constraints,
    strategicBrief: tx.strategic_brief,
    startingRecommendation: tx.starting_recommendation,
    goodIdeas: (tx.good_ideas as string[]) ?? [],
    trajectory: selected
      ? {
          name: selected.name,
          stance: selected.stance,
          description: selected.description,
          executiveBriefing: selected.executive_briefing,
        }
      : null,
    scenarios: (trajectories ?? []).map((t) => ({ name: t.name, stance: t.stance, selected: t.id === selected?.id })),
    headline,
    keyIndicators,
    indicators: ranked,
    confidence,
    modules,
    progressPercent,
    phases: phaseList,
    nextMilestone,
    targetDate,
    priorities: [...(priorities ?? [])]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .map((p) => ({ name: p.name, reason: p.reason })),
    risks: (risks ?? []).map((r) => ({ name: r.name, reason: r.reason })),
    opportunities: (opportunities ?? []).map((o) => ({ name: o.name, reason: o.reason })),
    matches: (matches ?? []).map((m) => ({ name: m.name, category: m.category, reason: m.reason })),
    trainings: (trainings ?? []).map((t) => ({ topic: t.topic, mode: t.mode })),
    hoursToRoadmap,
  };
}
