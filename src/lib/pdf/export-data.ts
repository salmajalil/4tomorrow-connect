import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ModuleRelevance, RecommendableModule, Training } from "@/types/database";
import type { Domain } from "@/lib/decide";
import type { DiagnosticResult } from "@/components/decide/diagnostic-view";
import type { ScenarioWithId } from "@/components/decide/scenario-card";
import type { ModelOutput, MatchOutput } from "@/lib/matching";

// Server-side data for the "decide", "connect" and "learn" PDF exports
// (src/app/api/export/pdf/route.ts). The export route used to render
// whatever object the client posted — anyone could produce a 4 Tomorrow
// branded PDF with arbitrary content. Now the client only sends an id and
// everything rendered is re-read here through the signed-in user's own
// Supabase client, so RLS decides what is visible (same principle as the
// "project-ceo" / "project-detailed" reports via fetchProjectImpact).
//
// The reconstruction mirrors the rehydration done by src/app/decide/page.tsx
// and src/app/connect/page.tsx (kept as-is there).

type Client = SupabaseClient<Database>;

export async function loadDecideExport(
  supabase: Client,
  transformationId: string
): Promise<{ diagnostic: DiagnosticResult; scenarios: ScenarioWithId[] } | null> {
  const { data: transformation } = await supabase
    .from("transformations")
    .select(
      "id, domains, maturity_reading, maturity_highlights, root_causes, decision_criteria, starting_recommendation, starting_actions"
    )
    .eq("id", transformationId)
    .maybeSingle();

  if (!transformation?.maturity_reading) return null;

  const [{ data: gaps }, { data: priorities }, { data: risks }, { data: recs }, { data: capabilityRows }] =
    await Promise.all([
      supabase.from("gaps").select("name, reason").eq("transformation_id", transformationId),
      supabase.from("priorities").select("name, reason, weight").eq("transformation_id", transformationId),
      supabase.from("risks").select("name, reason").eq("transformation_id", transformationId).is("trajectory_id", null),
      supabase.from("module_recommendations").select("module, relevance, reason").eq("transformation_id", transformationId),
      supabase
        .from("capability_assessments")
        .select("domain, observed, target, importance, gap, priority, status, proof_note")
        .eq("transformation_id", transformationId),
    ]);

  const moduleRecommendations: DiagnosticResult["moduleRecommendations"] = {
    connect: { relevance: "possible", reason: "" },
    learn: { relevance: "possible", reason: "" },
    deliver: { relevance: "possible", reason: "" },
  };
  for (const r of recs ?? []) {
    moduleRecommendations[r.module as RecommendableModule] = {
      relevance: r.relevance as ModuleRelevance,
      reason: r.reason ?? "",
    };
  }

  const diagnostic: DiagnosticResult = {
    transformationId: transformation.id,
    domains: (transformation.domains as Domain[]) ?? [],
    maturityReading: transformation.maturity_reading,
    maturityHighlights: (transformation.maturity_highlights as string[]) ?? [],
    gaps: (gaps ?? []).map((g) => ({ name: g.name, reason: g.reason ?? "" })),
    rootCauses: (transformation.root_causes as { name: string; reason: string }[]) ?? [],
    decisionCriteria: (transformation.decision_criteria as string[]) ?? [],
    priorities: (priorities ?? []).map((p) => ({ name: p.name, reason: p.reason ?? "", weight: p.weight ?? 0 })),
    risks: (risks ?? []).map((r) => ({ name: r.name, reason: r.reason ?? "" })),
    startingRecommendation: transformation.starting_recommendation ?? "",
    startingActions: (transformation.starting_actions as string[]) ?? [],
    moduleRecommendations,
    capabilityGaps: (capabilityRows ?? []).map((c) => ({
      domain: c.domain as Domain,
      observed: c.observed,
      target: c.target,
      importance: c.importance,
      gap: c.gap,
      priority: c.priority,
      status: c.status as "vérifié" | "non vérifié",
      proofNote: c.proof_note ?? "",
    })),
  };

  // Latest generation only (three scenarios), same as the Decide page.
  const { data: latestTrajectories } = await supabase
    .from("trajectories")
    .select("id, name, stance, description, tech_stack, scores, indicators, regulations, executive_briefing, briefing_highlights, veto")
    .eq("transformation_id", transformationId)
    .order("created_at", { ascending: false })
    .limit(3);
  const trajectories = latestTrajectories ? [...latestTrajectories].reverse() : [];

  let scenarios: ScenarioWithId[] = [];
  if (trajectories.length > 0) {
    const trajectoryIds = trajectories.map((t) => t.id);
    const [{ data: allMatches }, { data: scenarioRisks }, { data: scenarioOpps }] = await Promise.all([
      supabase.from("matches").select("*").in("trajectory_id", trajectoryIds),
      supabase.from("risks").select("*").in("trajectory_id", trajectoryIds),
      supabase.from("opportunities").select("*").in("trajectory_id", trajectoryIds),
    ]);

    scenarios = trajectories.map(
      (traj): ScenarioWithId => ({
        trajectoryId: traj.id,
        veto: traj.veto ?? false,
        name: traj.name,
        stance: traj.stance ?? "",
        description: traj.description ?? "",
        indicators: traj.indicators ?? {},
        radarScores: Object.fromEntries(
          Object.entries(traj.scores ?? {}).filter((entry): entry is [string, number] => entry[1] !== undefined)
        ),
        techStack: (traj.tech_stack ?? []).map((item) => ({
          name: item.name,
          maturity: item.maturity,
          maturityScale: item.maturityScale ?? "",
          detail: item.detail ?? "",
          benefit: item.benefit ?? "",
        })),
        suppliers: (allMatches ?? [])
          .filter((m) => m.trajectory_id === traj.id)
          .map((m) => ({
            category: m.category as ScenarioWithId["suppliers"][number]["category"],
            name: m.name,
            reason: m.reason ?? "",
            website: m.website,
            contactEmail: m.contact_email,
            source: m.source,
            ecosystemMemberId: m.ecosystem_member_id,
          })),
        regulations: traj.regulations ?? [],
        executiveBriefing: traj.executive_briefing ?? "",
        briefingHighlights: (traj.briefing_highlights as string[]) ?? [],
        risksSpecific: (scenarioRisks ?? [])
          .filter((r) => r.trajectory_id === traj.id)
          .map((r) => ({ name: r.name, reason: r.reason ?? "" })),
        opportunitiesSpecific: (scenarioOpps ?? [])
          .filter((o) => o.trajectory_id === traj.id)
          .map((o) => ({ name: o.name, reason: o.reason ?? "" })),
      })
    );
  }

  return { diagnostic, scenarios };
}

export async function loadConnectExport(
  supabase: Client,
  transformationId: string,
  fallbackProjectLabel: string
): Promise<{ result: ModelOutput; projectLabel: string } | null> {
  const { data: transformation } = await supabase
    .from("transformations")
    .select("id, organization_id, strategic_brief, good_ideas")
    .eq("id", transformationId)
    .maybeSingle();

  if (!transformation?.strategic_brief) return null;

  const [{ data: org }, { data: gaps }, { data: matches }] = await Promise.all([
    supabase.from("organizations").select("industry").eq("id", transformation.organization_id).maybeSingle(),
    supabase.from("gaps").select("name, reason").eq("transformation_id", transformation.id),
    supabase.from("matches").select("*").eq("transformation_id", transformation.id).is("trajectory_id", null),
  ]);

  return {
    projectLabel: org?.industry || fallbackProjectLabel,
    result: {
      gaps: (gaps ?? []).map((g) => ({ name: g.name, reason: g.reason ?? "" })),
      strategicBrief: transformation.strategic_brief,
      goodIdeas: (transformation.good_ideas as string[]) ?? [],
      matches: (matches ?? []).map(
        (m): MatchOutput => ({
          category: m.category as MatchOutput["category"],
          name: m.name,
          reason: m.reason ?? "",
          gapAddressed: m.gap_addressed ?? "",
          website: m.website,
          contactEmail: m.contact_email,
          source: m.source,
          ecosystemMemberId: m.ecosystem_member_id,
        })
      ),
    },
  };
}

export async function loadLearnExport(supabase: Client, trainingId: string): Promise<{ training: Training } | null> {
  const { data } = await supabase.from("trainings").select("*").eq("id", trainingId).maybeSingle();
  return data ? { training: data } : null;
}
