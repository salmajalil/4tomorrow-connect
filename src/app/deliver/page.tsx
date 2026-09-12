import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DeliverFlow } from "./deliver-flow";
import type { DeliverableKind, Deliverable } from "@/types/database";
import type { Domain } from "@/lib/decide";

function EmptyState({ title, message, ctaHref, ctaLabel }: { title: string; message: string; ctaHref: string; ctaLabel: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Eyebrow>Deliver</Eyebrow>
      <h1 className="mt-3 font-display text-3xl text-ink">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">{message}</p>
        <Link
          href={ctaHref}
          className="mt-4 inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong"
        >
          {ctaLabel}
        </Link>
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
    return (
      <EmptyState
        title={empty.title}
        message={empty.noOrgMessage}
        ctaHref="/decide"
        ctaLabel={empty.goToDecide}
      />
    );
  }

  const { data: candidates } = await supabase
    .from("transformations")
    .select("id, organization_id, challenges, objectives, domains, constraints, selected_trajectory_id, created_at")
    .in("organization_id", orgIds)
    .not("selected_trajectory_id", "is", null)
    .order("created_at", { ascending: false });

  if (!candidates || candidates.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        message={empty.noTrajectoryMessage}
        ctaHref="/decide"
        ctaLabel={empty.goToDecide}
      />
    );
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
