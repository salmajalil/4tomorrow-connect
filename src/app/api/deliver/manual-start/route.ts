import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";

// Lets a user skip Decide entirely and start Deliver from data typed
// directly here — creates the same shape Decide would have produced
// (a transformation with a selected trajectory) so the rest of Deliver
// (deliver-context.ts's loadMissionContext, generation routes) works
// completely unchanged. The trajectory carries no tech stack/indicators/
// regulations (nothing to generate them from) — AI deliverable generation
// just sees them as empty, same as an early, thin Decide scenario would.
export const maxDuration = 30;

const requestSchema = z.object({
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  challenges: z.string().trim().default(""),
  objectives: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour démarrer un projet." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  if (!body.challenges && !body.objectives) {
    return NextResponse.json(
      { error: "Décris au moins tes défis ou tes objectifs pour démarrer." },
      { status: 400 }
    );
  }

  const language = await getLanguage();

  // Same "one organization per user" reuse pattern as /api/decide/diagnostic.
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data: newOrg, error: orgError } = await supabase
      .from("organizations")
      .insert({
        owner_id: user.id,
        name: body.organization || body.industry || "Mon organisation",
        industry: body.industry || null,
      })
      .select("id")
      .single();
    if (orgError || !newOrg) {
      return NextResponse.json({ error: "Impossible de créer le projet. Réessaie." }, { status: 500 });
    }
    organizationId = newOrg.id;
  }

  const { data: transformation, error: transformationError } = await supabase
    .from("transformations")
    .insert({
      organization_id: organizationId,
      challenges: body.challenges || null,
      objectives: body.objectives || null,
      status: "active",
    })
    .select("id")
    .single();

  if (transformationError || !transformation) {
    return NextResponse.json({ error: "Impossible de créer le projet. Réessaie." }, { status: 500 });
  }

  const transformationId: string = transformation.id;
  const trajectoryName =
    body.challenges.slice(0, 72) || body.objectives.slice(0, 72) || body.organization || "Projet";

  const { data: trajectory, error: trajectoryError } = await supabase
    .from("trajectories")
    .insert({
      transformation_id: transformationId,
      name: trajectoryName,
      stance: language === "en" ? "Direct entry" : "Saisie directe",
      description: body.objectives || body.challenges,
    })
    .select("id")
    .single();

  if (trajectoryError || !trajectory) {
    return NextResponse.json({ error: "Impossible de créer le projet. Réessaie." }, { status: 500 });
  }

  const { error: linkError } = await supabase
    .from("transformations")
    .update({ selected_trajectory_id: trajectory.id })
    .eq("id", transformationId);

  if (linkError) {
    return NextResponse.json({ error: "Impossible de créer le projet. Réessaie." }, { status: 500 });
  }

  await setModuleStatus(supabase, transformationId, "deliver", "in_progress");

  return NextResponse.json({ transformationId });
}
