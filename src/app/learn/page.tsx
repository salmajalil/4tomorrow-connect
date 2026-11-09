import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { LearnFlow } from "./learn-flow";
import type { Training } from "@/types/database";
import { projectTitle } from "@/lib/text";
import { fetchProjectAccessScope, isAccessibleTransformation } from "@/lib/project-access";

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

  // Owned organizations' projects OR projects the user is an accepted
  // member of (src/lib/project-access.ts). The RLS-scoped transformations
  // query runs in parallel with the scope lookup, then is filtered by it.
  const [accessScope, { data: visibleTransformations }] = await Promise.all([
    fetchProjectAccessScope(supabase, user.id),
    supabase
      .from("transformations")
      .select("id, organization_id, challenges, objectives")
      .order("created_at", { ascending: false }),
  ]);

  const existingProjects: { id: string; title: string }[] = (visibleTransformations ?? [])
    .filter((tr) => isAccessibleTransformation(accessScope, tr))
    .map((tr) => ({
      id: tr.id,
      title:
        (tr.challenges?.trim() ? projectTitle(tr.challenges, 60) : tr.objectives?.trim() ? projectTitle(tr.objectives, 60) : "") ||
        t.common.untitledProject,
    }));

  // Only trust the query param transformationId if it's actually one of
  // this user's projects (owned or accepted member, list above) — never pass through
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
