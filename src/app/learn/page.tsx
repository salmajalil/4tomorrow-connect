import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LearnFlow } from "./learn-flow";

export default async function LearnPage({
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
    redirect("/login?next=/learn");
  }

  const { data: orgs } = await supabase.from("organizations").select("id").eq("owner_id", user.id);
  const orgIds = (orgs ?? []).map((o) => o.id);

  let existingProjects: { id: string; title: string }[] = [];
  if (orgIds.length > 0) {
    const { data: transformations } = await supabase
      .from("transformations")
      .select("id, challenges, objectives")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: false });

    existingProjects = (transformations ?? []).map((t) => ({
      id: t.id,
      title:
        (t.challenges?.trim() ? t.challenges.trim().slice(0, 60) : t.objectives?.trim()?.slice(0, 60)) ||
        "Projet sans titre",
    }));
  }

  // Only trust the query param transformationId if it's actually one of
  // this user's own projects (RLS-derived list above) — never pass through
  // an arbitrary id from the URL unchecked.
  const initialTransformationId =
    requestedTransformationId && existingProjects.some((p) => p.id === requestedTransformationId)
      ? requestedTransformationId
      : null;

  return <LearnFlow existingProjects={existingProjects} initialTransformationId={initialTransformationId} />;
}
