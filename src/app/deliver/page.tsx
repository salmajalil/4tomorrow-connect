import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DeliverStartOptions } from "@/components/deliver/deliver-start-options";
import { DeliverThemeWrap } from "@/components/deliver/deliver-theme";
import { DeliverFlow } from "./deliver-flow";
import type { DeliverableKind, Deliverable, BenefitExpectation, BenefitItem, BenefitObservation } from "@/types/database";
import type { Domain } from "@/lib/decide";
import { projectTitle as toProjectTitle } from "@/lib/text";
import { fetchProjectAccessScope, isAccessibleTransformation } from "@/lib/project-access";

function EmptyState({
  title,
  message,
  candidates,
}: {
  title: string;
  message: string;
  candidates: { id: string; title: string }[];
}) {
  return (
    <DeliverThemeWrap>
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Eyebrow>Deliver</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">{message}</p>
          <DeliverStartOptions candidates={candidates} />
        </div>
      </div>
    </DeliverThemeWrap>
  );
}

export default async function DeliverPage({
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
    redirect("/login?next=/deliver");
  }

  const language = await getLanguage();
  const t = getDictionary(language);
  const empty = t.deliver.empty;

  // Owned organizations' projects OR projects the user is an accepted
  // member of (src/lib/project-access.ts). The RLS-scoped transformations
  // query runs in parallel with the scope lookup, then is filtered by it.
  const [accessScope, { data: visibleTransformations }] = await Promise.all([
    fetchProjectAccessScope(supabase, user.id),
    supabase
      .from("transformations")
      .select("id, organization_id, challenges, objectives, domains, constraints, selected_trajectory_id, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const orgs = accessScope.ownedOrganizations;

  if (orgs.length === 0 && accessScope.memberTransformationIds.length === 0) {
    return <EmptyState title={empty.title} message={empty.noOrgMessage} candidates={[]} />;
  }

  const allTransformations = (visibleTransformations ?? []).filter((tr) => isAccessibleTransformation(accessScope, tr));

  const candidates = (allTransformations ?? []).filter((tr) => tr.selected_trajectory_id);
  // "Connect to Decide" candidates — a diagnostic already started in Decide
  // (a transformation exists) but no trajectory was ever picked there.
  const connectCandidates = (allTransformations ?? [])
    .filter((tr) => !tr.selected_trajectory_id)
    .map((tr) => ({
      id: tr.id,
      title: tr.challenges?.trim() ? toProjectTitle(tr.challenges, 60) : tr.objectives?.trim() ? toProjectTitle(tr.objectives, 60) : t.common.untitledProject,
    }));

  if (candidates.length === 0) {
    return <EmptyState title={empty.title} message={empty.noTrajectoryMessage} candidates={connectCandidates} />;
  }

  // Only trust the query param if it's actually one of this user's
  // eligible projects (owned or accepted member, list above) — never pass through an
  // arbitrary id from the URL unchecked.
  const transformation =
    candidates.find((c) => c.id === requestedTransformationId) ?? candidates[0];
  // Undefined on a project shared with the user: organizations RLS is
  // owner-only, so its name/industry fall back to "" below.
  const org = orgs.find((o) => o.id === transformation.organization_id);
  const trajectoryId = transformation.selected_trajectory_id as string;

  const [
    { data: deliverableRows },
    { data: phases },
    { data: priorities },
    { data: benefitExpectation },
    { data: benefitItems },
    { data: benefitObservations },
    { data: trajectory },
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*")
      .eq("transformation_id", transformation.id)
      .eq("trajectory_id", trajectoryId),
    supabase
      .from("roadmap_phases")
      .select("*")
      .eq("trajectory_id", trajectoryId)
      .order("order_index"),
    supabase.from("priorities").select("id, name, reason").eq("transformation_id", transformation.id),
    supabase.from("benefit_expectations").select("*").eq("transformation_id", transformation.id).maybeSingle(),
    supabase.from("benefit_items").select("*").eq("transformation_id", transformation.id).order("created_at"),
    supabase.from("benefit_observations").select("*").eq("transformation_id", transformation.id).order("month"),
    // Only the indicator names: they drive the KPI dashboard's
    // per-indicator questions (baseline + owner for each).
    supabase.from("trajectories").select("indicators").eq("id", trajectoryId).maybeSingle(),
  ]);

  const deliverables: Partial<Record<DeliverableKind, Deliverable>> = {};
  for (const row of (deliverableRows ?? []) as Deliverable[]) {
    deliverables[row.kind] = row;
  }

  const projectTitle = transformation.challenges?.trim()
    ? toProjectTitle(transformation.challenges)
    : transformation.objectives?.trim()
      ? toProjectTitle(transformation.objectives)
      : org?.name || t.common.untitledProject;

  return (
    <DeliverThemeWrap>
      <DeliverFlow
        transformationId={transformation.id}
        organizationId={transformation.organization_id}
        projectTitle={projectTitle}
        organization={org?.name ?? ""}
        industry={org?.industry ?? ""}
        domains={(transformation.domains as Domain[]) ?? []}
        initialConstraints={transformation.constraints ?? ""}
        initialDeliverables={deliverables}
        roadmapPhases={phases ?? []}
        priorities={priorities ?? []}
        initialBenefitExpectation={(benefitExpectation as BenefitExpectation | null) ?? null}
        initialBenefitItems={(benefitItems as BenefitItem[] | null) ?? []}
        initialBenefitObservations={(benefitObservations as BenefitObservation[] | null) ?? []}
        indicatorNames={Object.keys(trajectory?.indicators ?? {})}
      />
    </DeliverThemeWrap>
  );
}
