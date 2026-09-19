import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DecideThemeWrap } from "@/components/decide/decide-theme";
import { DecideFlow } from "./decide-flow";
import type { Domain } from "@/lib/decide";
import type { DiagnosticResult } from "@/components/decide/diagnostic-view";
import type { ScenarioWithId } from "@/components/decide/scenario-card";
import type { RecommendableModule, ModuleRelevance } from "@/types/database";

export default async function DecidePage({
  searchParams,
}: {
  searchParams: Promise<{ transformationId?: string }>;
}) {
  const { transformationId: requestedTransformationId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/decide");
  }

  // Resume the requested project, or — visiting /decide plain — the user's
  // most recent one, so coming back here picks up where you left off
  // instead of always starting at a blank intake form.
  const { data: orgs } = await supabase.from("organizations").select("id").eq("owner_id", user.id);
  const orgIds = (orgs ?? []).map((o) => o.id);

  let transformationId: string | null = null;
  if (orgIds.length > 0) {
    if (requestedTransformationId) {
      const { data: tx } = await supabase
        .from("transformations")
        .select("id")
        .eq("id", requestedTransformationId)
        .in("organization_id", orgIds)
        .maybeSingle();
      transformationId = tx?.id ?? null;
    } else {
      const { data: tx } = await supabase
        .from("transformations")
        .select("id")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      transformationId = tx?.id ?? null;
    }
  }

  let initialDiagnostic: DiagnosticResult | null = null;
  let initialScenarios: ScenarioWithId[] | null = null;
  let initialSelectedTrajectoryId: string | null = null;

  if (transformationId) {
    const { data: transformation } = await supabase
      .from("transformations")
      .select(
        "id, domains, maturity_reading, root_causes, decision_criteria, starting_recommendation, selected_trajectory_id"
      )
      .eq("id", transformationId)
      .maybeSingle();

    // Only rehydrate the diagnostic phase when the narrative fields are
    // actually saved — a project created before this persistence existed
    // won't have them, and just starts fresh at intake instead.
    if (transformation?.maturity_reading) {
      const [{ data: gaps }, { data: priorities }, { data: risks }, { data: recs }] = await Promise.all([
        supabase.from("gaps").select("name, reason").eq("transformation_id", transformationId),
        supabase.from("priorities").select("name, reason, weight").eq("transformation_id", transformationId),
        supabase
          .from("risks")
          .select("name, reason")
          .eq("transformation_id", transformationId)
          .is("trajectory_id", null),
        supabase.from("module_recommendations").select("module, relevance, reason").eq("transformation_id", transformationId),
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

      initialDiagnostic = {
        transformationId: transformation.id,
        domains: (transformation.domains as Domain[]) ?? [],
        maturityReading: transformation.maturity_reading,
        gaps: (gaps ?? []).map((g) => ({ name: g.name, reason: g.reason ?? "" })),
        rootCauses: (transformation.root_causes as { name: string; reason: string }[]) ?? [],
        decisionCriteria: (transformation.decision_criteria as string[]) ?? [],
        priorities: (priorities ?? []).map((p) => ({ name: p.name, reason: p.reason ?? "", weight: p.weight ?? 0 })),
        risks: (risks ?? []).map((r) => ({ name: r.name, reason: r.reason ?? "" })),
        startingRecommendation: transformation.starting_recommendation ?? "",
        moduleRecommendations,
      };
      initialSelectedTrajectoryId = transformation.selected_trajectory_id ?? null;

      // If scenarios were already generated for this project, rehydrate them
      // too, so returning here shows the full comparison, not just the
      // diagnostic.
      const { data: trajectories } = await supabase
        .from("trajectories")
        .select("id, name, stance, description, tech_stack, scores, indicators, regulations, executive_briefing")
        .eq("transformation_id", transformationId)
        .order("created_at", { ascending: true });

      if (trajectories && trajectories.length > 0) {
        const trajectoryIds = trajectories.map((t) => t.id);
        const [{ data: allMatches }, { data: scenarioRisks }, { data: scenarioOpps }] = await Promise.all([
          supabase.from("matches").select("*").in("trajectory_id", trajectoryIds),
          supabase.from("risks").select("*").in("trajectory_id", trajectoryIds),
          supabase.from("opportunities").select("*").in("trajectory_id", trajectoryIds),
        ]);

        initialScenarios = trajectories.map(
          (traj): ScenarioWithId => ({
            trajectoryId: traj.id,
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
            risksSpecific: (scenarioRisks ?? [])
              .filter((r) => r.trajectory_id === traj.id)
              .map((r) => ({ name: r.name, reason: r.reason ?? "" })),
            opportunitiesSpecific: (scenarioOpps ?? [])
              .filter((o) => o.trajectory_id === traj.id)
              .map((o) => ({ name: o.name, reason: o.reason ?? "" })),
          })
        );
      }
    }
  }

  return (
    <DecideThemeWrap>
      <DecideFlow
        initialDiagnostic={initialDiagnostic}
        initialScenarios={initialScenarios}
        initialSelectedTrajectoryId={initialSelectedTrajectoryId}
      />
    </DecideThemeWrap>
  );
}
