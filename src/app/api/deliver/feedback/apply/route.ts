import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { RecalibrationSummary, RoadmapPhaseEntry } from "@/types/database";

const requestSchema = z.object({
  feedbackId: z.string().uuid(),
  applyRoadmapAdjustment: z.boolean().default(false),
});

// Applies a recalibration PROPOSAL the user has reviewed — never called
// automatically after /api/deliver/feedback. Priorities are always
// updated (that's the low-stakes half); the roadmap is only touched when
// the caller explicitly opts in, per the brief's "jamais une réécriture
// automatique silencieuse" rule.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  const { data: feedback, error: feedbackError } = await supabase
    .from("mission_feedback")
    .select("*")
    .eq("id", body.feedbackId)
    .maybeSingle();

  if (feedbackError || !feedback) {
    return NextResponse.json({ error: "Feedback introuvable." }, { status: 404 });
  }
  if (feedback.applied) {
    return NextResponse.json({ error: "Ce feedback a déjà été appliqué." }, { status: 400 });
  }

  const summary = feedback.ai_summary as RecalibrationSummary;

  // Replace priorities wholesale with the recalibrated set — mirrors how
  // Decide's own priorities are a fresh read of the current diagnosis, not
  // an incremental patch. (weight isn't persisted here either, same as
  // Decide's diagnostic route — the priorities table has no weight column.)
  await supabase.from("priorities").delete().eq("transformation_id", feedback.transformation_id);
  if (summary.updatedPriorities.length > 0) {
    await supabase.from("priorities").insert(
      summary.updatedPriorities.map((p) => ({
        transformation_id: feedback.transformation_id,
        name: p.name,
        reason: p.reason,
      }))
    );
  }

  if (body.applyRoadmapAdjustment && summary.roadmapAdjustment?.proposed) {
    for (const change of summary.roadmapAdjustment.phaseChanges) {
      const update: Partial<Pick<RoadmapPhaseEntry, "end_date" | "actions">> = {};
      if (change.newEndDate) update.end_date = change.newEndDate;
      if (change.newActions && change.newActions.length > 0) update.actions = change.newActions;
      if (Object.keys(update).length === 0) continue;
      await supabase
        .from("roadmap_phases")
        .update(update)
        .eq("trajectory_id", feedback.trajectory_id)
        .eq("phase_name", change.phaseName);
    }
  }

  await supabase.from("mission_feedback").update({ applied: true }).eq("id", feedback.id);

  return NextResponse.json({ applied: true });
}
