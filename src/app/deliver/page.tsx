import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DeliverStartOptions } from "@/components/deliver/deliver-start-options";
import { DeliverFlow } from "./deliver-flow";
import type { DeliverableKind, Deliverable } from "@/types/database";
import type { Domain } from "@/lib/decide";

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
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Eyebrow>Deliver</Eyebrow>
      <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
      <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">{message}</p>
        <DeliverStartOptions candidates={candidates} />
      </div>
    </div>
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

  const { data: orgs } = await supabase.from("organizations").select("id, name, industry").eq("owner_id", user.id);
  const orgIds = (orgs ?? []).map((o) => o.id);

  if (orgIds.length === 0) {
    return <EmptyState title={empty.title} message={empty.noOrgMessage} candidates={[]} />;
  }

  const { data: allTransformations } = await supabase
    .from("transformations")
    .select("id, organization_id, challenges, objectives, domains, constraints, selected_trajectory_id, created_at")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });

  const candidates = (allTransformations ?? []).filter((tr) => tr.selected_trajectory_id);
  // "Connect to Decide" candidates — a diagnostic already started in Decide
  // (a transformation exists) but no trajectory was ever picked there.
  const connectCandidates = (allTransformations ?? [])
    .filter((tr) => !tr.selected_trajectory_id)
    .map((tr) => ({
      id: tr.id,
      title:
        tr.challenges?.trim()?.slice(0, 60) || tr.objectives?.trim()?.slice(0, 60) || t.common.untitledProject,
    }));

  if (candidates.length === 0) {
    return <EmptyState title={empty.title} message={empty.noTrajectoryMessage} candidates={connectCandidates} />;
  }

  // Only trust the query param if it's actually one of this user's own
  // eligible projects (RLS-derived list above) — never pass through an
  // arbitrary id from the URL unchecked.
  const transformation =
    candidates.find((c) => c.id === requestedTransformationId) ?? candidates[0];
  const org = (orgs ?? []).find((o) => o.id === transformation.organization_id);
  const trajectoryId = transformation.selected_trajectory_id as string;

  const [{ data: deliverableRows }, { data: phases }, { data: priorities }] = await Promise.all([
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
  ]);

  const deliverables: Partial<Record<DeliverableKind, Deliverable>> = {};
  for (const row of (deliverableRows ?? []) as Deliverable[]) {
    deliverables[row.kind] = row;
  }

  const projectTitle = transformation.challenges?.trim()
    ? transformation.challenges.trim().slice(0, 72)
    : transformation.objectives?.trim()?.slice(0, 72) || org?.name || t.common.untitledProject;

  return (
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
    />
  );
}
