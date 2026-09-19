import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";

// "Connect to Decide" — the user already started a diagnostic in Decide
// (a transformation exists) but never picked a trajectory there. Rather
// than sending them back to Decide to click "Choisir ce scénario", this
// auto-connects it to Deliver: reuse the first scenario Decide already
// generated for it if one exists (real tech stack/indicators/briefing —
// strictly better than a blank one), otherwise fall back to a thin
// trajectory built straight from the diagnostic's own challenges/
// objectives/domains, same shape the manual-start route produces.
export const maxDuration = 30;

const requestSchema = z.object({
  transformationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to connect a project." : "Connecte-toi pour connecter un projet." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  // RLS scopes this to the caller's own transformation — a foreign id
  // simply returns no row, handled below as 404.
  const { data: transformation, error: txError } = await supabase
    .from("transformations")
    .select("id, challenges, objectives, domains, selected_trajectory_id")
    .eq("id", body.transformationId)
    .maybeSingle();

  if (txError || !transformation) {
    return NextResponse.json(
      { error: language === "en" ? "Decide project not found." : "Projet Decide introuvable." },
      { status: 404 }
    );
  }

  if (transformation.selected_trajectory_id) {
    return NextResponse.json({ transformationId: transformation.id });
  }

  const { data: existingTrajectories } = await supabase
    .from("trajectories")
    .select("id")
    .eq("transformation_id", transformation.id)
    .order("created_at", { ascending: true })
    .limit(1);

  let trajectoryId = existingTrajectories?.[0]?.id as string | undefined;

  if (!trajectoryId) {
    const trajectoryName =
      (transformation.challenges ?? "").trim().slice(0, 72) ||
      (transformation.objectives ?? "").trim().slice(0, 72) ||
      "Projet";

    const { data: newTrajectory, error: trajectoryError } = await supabase
      .from("trajectories")
      .insert({
        transformation_id: transformation.id,
        name: trajectoryName,
        stance: language === "en" ? "Connected from Decide" : "Connecté depuis Decide",
        description: transformation.objectives ?? transformation.challenges ?? "",
      })
      .select("id")
      .single();

    if (trajectoryError || !newTrajectory) {
      return NextResponse.json(
        { error: language === "en" ? "Couldn't connect this project. Try again." : "Impossible de connecter ce projet. Réessaie." },
        { status: 500 }
      );
    }
    trajectoryId = newTrajectory.id;
  }

  const { error: linkError } = await supabase
    .from("transformations")
    .update({ selected_trajectory_id: trajectoryId })
    .eq("id", transformation.id);

  if (linkError) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't connect this project. Try again." : "Impossible de connecter ce projet. Réessaie." },
      { status: 500 }
    );
  }

  await setModuleStatus(supabase, transformation.id, "deliver", "in_progress");

  return NextResponse.json({ transformationId: transformation.id });
}
