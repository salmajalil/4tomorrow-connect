import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";

// Fourth way to start Deliver without Decide: drop a project document and
// skip the wizard entirely. The extracted text goes straight into
// transformations.challenges — unlike Decide's own upload (used once,
// live, inside a single AI call and never persisted), Deliver has no
// generation step at creation time, so this is the one place the text can
// durably reach every future deliverable generation: loadMissionContext
// reads challenges into DeliverGenerationContext, which every /api/deliver
// generation route feeds to the model as-is.
export const maxDuration = 30;

// Generous but bounded — a full spec document, not unlimited raw upload.
const MAX_DOC_LENGTH = 20_000;

const requestSchema = z.object({
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  sourceDocText: z.string().trim().min(1).max(MAX_DOC_LENGTH),
  sourceDocName: z.string().trim().default(""),
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
      challenges: body.sourceDocText,
      status: "active",
    })
    .select("id")
    .single();

  if (transformationError || !transformation) {
    return NextResponse.json({ error: "Impossible de créer le projet. Réessaie." }, { status: 500 });
  }

  const transformationId: string = transformation.id;
  const trajectoryName = body.sourceDocName || body.organization || "Projet";

  const { data: trajectory, error: trajectoryError } = await supabase
    .from("trajectories")
    .insert({
      transformation_id: transformationId,
      name: trajectoryName,
      stance: language === "en" ? "Imported document" : "Document importé",
      description: body.sourceDocText.slice(0, 300),
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
