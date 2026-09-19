import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { LearnFlow } from "./learn-flow";
import type { Training } from "@/types/database";

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

  const language = await getLanguage();
  const t = getDictionary(language);

  const { data: orgs } = await supabase.from("organizations").select("id").eq("owner_id", user.id);
  const orgIds = (orgs ?? []).map((o) => o.id);

  let existingProjects: { id: string; title: string }[] = [];
  if (orgIds.length > 0) {
    const { data: transformations } = await supabase
      .from("transformations")
      .select("id, challenges, objectives")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: false });

    existingProjects = (transformations ?? []).map((tr) => ({
      id: tr.id,
      title:
        (tr.challenges?.trim() ? tr.challenges.trim().slice(0, 60) : tr.objectives?.trim()?.slice(0, 60)) ||
        t.common.untitledProject,
    }));
  }

  // Only trust the query param transformationId if it's actually one of
  // this user's own projects (RLS-derived list above) — never pass through
  // an arbitrary id from the URL unchecked.
  const initialTransformationId =
    requestedTransformationId && existingProjects.some((p) => p.id === requestedTransformationId)
      ? requestedTransformationId
      : null;

  // If this project already has a generated training, show it directly
  // instead of making the user regenerate it — same "remember input and
  // output" fix as Decide.
  let initialTraining: Training | null = null;
  if (initialTransformationId) {
    const { data } = await supabase
      .from("trainings")
      .select("*")
      .eq("transformation_id", initialTransformationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    initialTraining = data ?? null;
  }

  return (
    <LearnFlow
      existingProjects={existingProjects}
      initialTransformationId={initialTransformationId}
      initialTraining={initialTraining}
    />
  );
}
