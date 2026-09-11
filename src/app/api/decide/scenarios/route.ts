import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildScenarioSystemPrompt,
  buildScenariosUserPrompt,
  parseScenarioOutput,
  DecideParseError,
  type Domain,
  type ScenarioOutput,
  type ScenarioSlot,
} from "@/lib/decide";
import { setModuleStatus } from "@/lib/module-status";
import type { EcosystemMember } from "@/types/database";

// Headroom above MATCHING_TIMEOUT_MS (src/lib/anthropic.ts, 170s) — same
// budget CONNECT settled on after production timeout tuning.
export const maxDuration = 180;

const requestSchema = z.object({
  transformationId: z.string().uuid("Transformation invalide."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour générer des scénarios." }, { status: 401 });
  }

  let transformationId: string;
  try {
    const json = await request.json();
    ({ transformationId } = requestSchema.parse(json));
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  // RLS scopes this to the caller's own transformation — a foreign id
  // simply returns no row, handled below as 404.
  const { data: transformation, error: txError } = await supabase
    .from("transformations")
    .select("id, organization_id, challenges, objectives, constraints, domains")
    .eq("id", transformationId)
    .maybeSingle();

  if (txError || !transformation) {
    return NextResponse.json({ error: "Transformation introuvable." }, { status: 404 });
  }

  const [{ data: org }, { data: gaps }, { data: priorities }, { data: registry }] = await Promise.all([
    supabase.from("organizations").select("name, industry").eq("id", transformation.organization_id).maybeSingle(),
    supabase.from("gaps").select("name, reason").eq("transformation_id", transformationId),
    supabase.from("priorities").select("name, reason").eq("transformation_id", transformationId),
    supabase.from("ecosystem_members").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const domains = (transformation.domains as Domain[]) ?? [];
  const anthropic = getAnthropicClient();
  const userPrompt = buildScenariosUserPrompt({
    domains,
    organization: org?.name ?? "",
    industry: org?.industry ?? "",
    challenges: transformation.challenges ?? "",
    objectives: transformation.objectives ?? "",
    constraints: transformation.constraints ?? "",
    gaps: (gaps ?? []).map((g) => ({ name: g.name, reason: g.reason ?? "" })),
    priorities: (priorities ?? []).map((p) => ({ name: p.name, reason: p.reason ?? "" })),
  });

  // One scenario per call, in parallel — a single call generating all 3 full
  // scenarios exceeded the production timeout budget (see decide.ts comment
  // above buildScenarioSystemPrompt). Wall-clock time here is bounded by the
  // slowest of the 3, not their sum.
  const slots: ScenarioSlot[] = [1, 2, 3];
  const settled = await Promise.allSettled(
    slots.map(async (slot) => {
      const system = buildScenarioSystemPrompt((registry ?? []) as EcosystemMember[], slot);
      const response = await anthropic.messages.create({
        model: MATCHING_MODEL,
        // max_tokens covers the whole call, search rounds included, not just
        // the final block — 3000 was tuned for CONNECT's single-category
        // match and was too tight for one full scenario (tech stack +
        // suppliers + regulations + briefing + risks/opportunities): the
        // model was hitting the cap mid-JSON, which surfaced as "no
        // <RESULT_JSON> found" in production once the earlier network-drop
        // issue was fixed and real server responses started coming through.
        max_tokens: 5000,
        system,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 2 }],
      });
      const rawText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return parseScenarioOutput(rawText);
    })
  );

  const scenarios: ScenarioOutput[] = settled
    .filter((r): r is PromiseFulfilledResult<ScenarioOutput> => r.status === "fulfilled")
    .map((r) => r.value);

  if (scenarios.length === 0) {
    const firstError = settled.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
    if (firstError instanceof Anthropic.APIError) {
      const status = firstError.status === 401 || firstError.status === 403 ? 502 : (firstError.status ?? 502);
      return NextResponse.json(
        { error: "Le moteur de scénarios n'a pas pu répondre. Réessaie dans un instant." },
        { status }
      );
    }
    if (firstError instanceof DecideParseError) {
      return NextResponse.json({ error: firstError.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Le moteur de scénarios a mis trop de temps à répondre. Réessaie." },
      { status: 504 }
    );
  }

  const knownRegistryIds = new Set((registry ?? []).map((m) => m.id));
  const persistedScenarios: { trajectoryId: string; scenario: ScenarioOutput }[] = [];

  for (const scenario of scenarios) {
    const { data: trajectory, error: trajectoryError } = await supabase
      .from("trajectories")
      .insert({
        transformation_id: transformationId,
        name: scenario.name,
        stance: scenario.stance,
        description: scenario.description,
        tech_stack: scenario.techStack,
        scores: scenario.radarScores,
        indicators: scenario.indicators,
        regulations: scenario.regulations,
        executive_briefing: scenario.executiveBriefing,
      })
      .select("id")
      .single();

    if (trajectoryError || !trajectory) continue;
    const trajectoryId: string = trajectory.id;
    persistedScenarios.push({ trajectoryId, scenario });

    if (scenario.suppliers.length > 0) {
      await supabase.from("matches").insert(
        scenario.suppliers.map((s) => ({
          transformation_id: transformationId,
          trajectory_id: trajectoryId,
          category: s.category,
          name: s.name,
          reason: s.reason,
          website: s.website ?? null,
          contact_email: s.contactEmail ?? null,
          ecosystem_member_id:
            s.source === "registry" && s.ecosystemMemberId && knownRegistryIds.has(s.ecosystemMemberId)
              ? s.ecosystemMemberId
              : null,
          source: s.source,
        }))
      );
    }

    if (scenario.risksSpecific.length > 0) {
      await supabase.from("risks").insert(
        scenario.risksSpecific.map((r) => ({
          transformation_id: transformationId,
          trajectory_id: trajectoryId,
          name: r.name,
          reason: r.reason,
        }))
      );
    }

    if (scenario.opportunitiesSpecific.length > 0) {
      await supabase.from("opportunities").insert(
        scenario.opportunitiesSpecific.map((o) => ({
          transformation_id: transformationId,
          trajectory_id: trajectoryId,
          name: o.name,
          reason: o.reason,
          module_origin: "decide",
        }))
      );
    }
  }

  await setModuleStatus(supabase, transformationId, "decide", "in_progress");

  return NextResponse.json({
    scenarios: persistedScenarios.map(({ trajectoryId, scenario }) => ({ trajectoryId, ...scenario })),
    ...(persistedScenarios.length < 3
      ? { warning: `${persistedScenarios.length} scénario(s) sur 3 généré(s) — les autres ont échoué, tu peux réessayer.` }
      : {}),
  });
}
