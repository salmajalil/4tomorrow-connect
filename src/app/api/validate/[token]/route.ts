import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateConsumption, isTokenStillUsable, type ValidationTokenRecord, type CurrentDecisionState } from "@/lib/validation-token";
import { getLanguage } from "@/lib/i18n/language";

// L09 — route publique (pas de session requise) derrière un jeton opaque à
// usage unique. Toujours filtrée par `token` exact, jamais par un id
// séquentiel listable — voir src/lib/supabase/service.ts.
async function loadState(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const { data: tokenRow } = await supabase
    .from("ceo_validation_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) return null;

  const { data: tx } = await supabase
    .from("transformations")
    .select("id, selected_trajectory_id, decision_updated_at")
    .eq("id", tokenRow.transformation_id)
    .maybeSingle();
  if (!tx) return null;

  const record: ValidationTokenRecord = {
    transformationId: tokenRow.transformation_id,
    trajectoryId: tokenRow.trajectory_id,
    decisionSnapshot: tokenRow.decision_snapshot,
    expiresAt: tokenRow.expires_at,
    usedAt: tokenRow.used_at,
  };
  const current: CurrentDecisionState = {
    transformationId: tx.id,
    trajectoryId: tx.selected_trajectory_id,
    decisionUpdatedAt: tx.decision_updated_at,
  };
  return { tokenRow, record, current };
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const state = await loadState(supabase, token);
  if (!state) {
    return NextResponse.json({ ok: false, reason: "Lien de validation introuvable." }, { status: 404 });
  }

  const usable = isTokenStillUsable(state.record, state.current, new Date());

  const { data: trajectory } = await supabase
    .from("trajectories")
    .select("name, stance, description, executive_briefing, indicators")
    .eq("id", state.record.trajectoryId)
    .maybeSingle();

  return NextResponse.json({
    ok: usable.ok,
    reason: usable.reason,
    alreadyDecided: state.tokenRow.outcome !== null,
    outcome: state.tokenRow.outcome,
    decision: trajectory
      ? {
          name: trajectory.name,
          stance: trajectory.stance,
          description: trajectory.description,
          executiveBriefing: trajectory.executive_briefing,
          indicators: trajectory.indicators,
        }
      : null,
    transformationId: state.record.transformationId,
  });
}

const postSchema = z.object({
  confirmed: z.boolean(),
  outcome: z.enum(["validated", "needs_more_info", "rejected"]),
  note: z.string().trim().default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const language = await getLanguage();
  const supabase = createServiceClient();

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const state = await loadState(supabase, token);
  if (!state) {
    return NextResponse.json(
      { error: language === "en" ? "Validation link not found." : "Lien de validation introuvable." },
      { status: 404 }
    );
  }

  // Opening the link alone (GET above) never reaches this branch — only an
  // explicit POST with confirmed=true can consume the token, per brief.
  const now = new Date();
  const result = evaluateConsumption(state.record, state.current, now, body.confirmed);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  const { error } = await supabase
    .from("ceo_validation_tokens")
    .update({ used_at: now.toISOString(), outcome: body.outcome, outcome_note: body.note || null })
    .eq("token", token)
    .is("used_at", null); // garde-fou supplémentaire contre une double-consommation concurrente

  if (error) {
    return NextResponse.json(
      { error: language === "en" ? "Could not record the decision." : "Impossible d'enregistrer la décision." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
