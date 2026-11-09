import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ModuleName,
  ModuleStatusValue,
  RecommendableModule,
  ModuleRelevance,
  TransformationMember,
  ValidationOutcomeValue,
} from "@/types/database";
import { projectTitle } from "@/lib/text";
import type { ActionStatus } from "@/types/database";
import { fetchProjectAccessScope, isAccessibleTransformation } from "@/lib/project-access";

// "Réponse CEO reçue" in the control tower: there is no "seen" flag on
// ceo_validation_tokens, so a response stays listed for this many days
// after the CEO answered.
export const CEO_RESPONSE_WINDOW_DAYS = 7;

export const MODULE_ORDER: ModuleName[] = ["decide", "connect", "learn", "deliver"];

export type ControlTowerProject = {
  transformationId: string;
  title: string;
  // Full challenge statement, kept for the card subtitle; the title itself
  // is now the short "organisation · domain" form.
  summary: string;
  archived: boolean;
  organizationName: string;
  domains: string[];
  createdAt: string;
  moduleStatus: Record<ModuleName, ModuleStatusValue>;
  moduleRecommendations: { module: RecommendableModule; relevance: ModuleRelevance; reason: string | null }[];
  priorities: { name: string; reason: string | null }[];
  risks: {
    id: string;
    name: string;
    reason: string | null;
    probability: number | null;
    impact: number | null;
    owner: string | null;
    treatment: string | null;
    impacted_object: string | null;
  }[];
  // Roadmap phase names — suggestions for a risk's "impacted object".
  phaseNames: string[];
  opportunities: { id: string; name: string; reason: string | null }[];
  actions: { id: string; title: string; owner: string | null; due_date: string | null; status: ActionStatus; source_module: string | null }[];
  keyMetrics: { key: string; value: string | number }[];
  pendingValidationCount: number;
  matchesCount: number;
  progressPercent: number; // modules done / 4
  targetDate: string | null; // furthest roadmap_phases.end_date, if a roadmap exists
  members: TransformationMember[];
  // CEO answers (validate / more info / reject) received over the last
  // CEO_RESPONSE_WINDOW_DAYS days, most recent first.
  ceoResponses: { id: string; outcome: ValidationOutcomeValue; outcomeNote: string | null; respondedAt: string }[];
};

// One aggregate fetch, called both for the initial server render and again
// on the client after any Realtime event — small dataset (a single user's
// projects), so a full re-fetch is simpler and safer than patching state
// incrementally per event type.
export async function fetchControlTowerProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
  untitledProjectLabel = "Projet sans titre"
): Promise<ControlTowerProject[]> {
  // Owned organizations' projects OR projects the user is an accepted
  // member of (see src/lib/project-access.ts). The transformations query is
  // RLS-scoped to exactly that union already, so it runs in parallel with
  // the scope lookup instead of waiting on it; the explicit filter below
  // then re-checks every row against the scope.
  const [scope, { data: visibleTransformations }] = await Promise.all([
    fetchProjectAccessScope(supabase, userId),
    supabase
      .from("transformations")
      .select("id, organization_id, challenges, objectives, domains, status, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const transformations = (visibleTransformations ?? []).filter((t) => isAccessibleTransformation(scope, t));
  if (transformations.length === 0) return [];
  // Only the owner can read an organization row (organizations RLS is
  // owner-only), so a project shared with the user has no organization name.
  const orgNameById = new Map(scope.ownedOrganizations.map((o) => [o.id, o.name]));
  const txIds = transformations.map((t) => t.id);
  const ceoResponsesSince = new Date(Date.now() - CEO_RESPONSE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: statuses },
    { data: recommendations },
    { data: priorities },
    { data: risks },
    { data: opportunities },
    { data: trajectories },
    { data: matches },
    { data: roadmapPhases },
    { data: actions },
    membersResult,
    ceoTokensResult,
  ] = await Promise.all([
    supabase.from("module_status").select("transformation_id, module, status").in("transformation_id", txIds),
    supabase
      .from("module_recommendations")
      .select("transformation_id, module, relevance, reason")
      .in("transformation_id", txIds),
    supabase.from("priorities").select("transformation_id, name, reason").in("transformation_id", txIds),
    // "*" so impacted_object (0027) is read when present without failing
    // the whole control tower on a database that hasn't run it yet.
    supabase.from("risks").select("*").in("transformation_id", txIds),
    supabase
      .from("opportunities")
      .select("id, transformation_id, name, reason")
      .in("transformation_id", txIds),
    supabase.from("trajectories").select("transformation_id, indicators").in("transformation_id", txIds),
    supabase.from("matches").select("id, transformation_id").in("transformation_id", txIds),
    supabase
      .from("roadmap_phases")
      .select("transformation_id, phase_name, end_date, order_index")
      .in("transformation_id", txIds)
      .order("order_index"),
    supabase
      .from("actions")
      .select("id, transformation_id, title, owner, due_date, status, source_module")
      .in("transformation_id", txIds),
    // PROJET ET ÉQUIPE — best-effort: on a database that hasn't run
    // 0015_team_roles.sql yet, this table doesn't exist and the call
    // returns an error; treat that exactly like "no members" rather than
    // failing the whole control tower fetch. Independent of every query
    // above, so it runs in the same parallel batch.
    supabase
      .from("transformation_members")
      .select("id, transformation_id, user_id, invited_email, role, domain, invited_at, accepted_at, created_at")
      .in("transformation_id", txIds),
    // Same best-effort treatment (0017). RLS: owner-only today.
    supabase
      .from("ceo_validation_tokens")
      .select("id, transformation_id, outcome, outcome_note, used_at")
      .in("transformation_id", txIds)
      .not("outcome", "is", null)
      .gte("used_at", ceoResponsesSince)
      .order("used_at", { ascending: false }),
  ]);
  const members = membersResult.data ?? [];
  const ceoTokens = ceoTokensResult.data ?? [];

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
      ? projectTitle(t.challenges)
      : t.objectives?.trim()
        ? projectTitle(t.objectives)
        : orgNameById.get(t.organization_id) || untitledProjectLabel;

    return {
      transformationId: t.id,
      title,
      summary: projectTitle(t.challenges?.trim() || t.objectives?.trim() || "", 160),
      archived: t.status === "archived",
      organizationName: orgNameById.get(t.organization_id) ?? "",
      domains: (t.domains as string[]) ?? [],
      createdAt: t.created_at,
      moduleStatus,
      moduleRecommendations: (recommendations ?? [])
        .filter((r) => r.transformation_id === t.id)
        .map((r) => ({ module: r.module, relevance: r.relevance, reason: r.reason })),
      priorities: (priorities ?? []).filter((p) => p.transformation_id === t.id),
      risks: (risks ?? [])
        .filter((r) => r.transformation_id === t.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          reason: r.reason,
          probability: r.probability,
          impact: r.impact,
          owner: r.owner,
          treatment: r.treatment,
          impacted_object: r.impacted_object ?? null,
        })),
      phaseNames: (roadmapPhases ?? []).filter((r) => r.transformation_id === t.id).map((r) => r.phase_name),
      opportunities: (opportunities ?? []).filter((o) => o.transformation_id === t.id),
      actions: (actions ?? []).filter((a) => a.transformation_id === t.id),
      keyMetrics,
      pendingValidationCount,
      matchesCount: (matches ?? []).filter((m) => m.transformation_id === t.id).length,
      progressPercent,
      targetDate,
      members: members.filter((m) => m.transformation_id === t.id),
      ceoResponses: ceoTokens
        .filter((c) => c.transformation_id === t.id && c.outcome !== null && c.used_at !== null)
        .map((c) => ({
          id: c.id,
          outcome: c.outcome as ValidationOutcomeValue,
          outcomeNote: c.outcome_note,
          respondedAt: c.used_at as string,
        })),
    };
  });
}

// Invitations addressed to this e-mail that haven't been accepted yet
// (visible to the invitee since 0025_claim_pending_invitations.sql). The
// e-mail match is done here, case-insensitively, rather than in the query:
// an owner also sees every other pending invite on their own projects, and
// a LIKE pattern would mis-handle "_" in addresses. Best-effort: any error
// counts as "none".
export async function fetchPendingInvitationCount(
  supabase: SupabaseClient<Database>,
  email: string | null | undefined
): Promise<number> {
  if (!email) return 0;
  const { data } = await supabase.from("transformation_members").select("invited_email").is("accepted_at", null);
  const target = email.trim().toLowerCase();
  return (data ?? []).filter((m) => m.invited_email.trim().toLowerCase() === target).length;
}
