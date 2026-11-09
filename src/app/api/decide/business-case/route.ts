import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { computeBusinessCase, validateBusinessCaseInputs } from "@/lib/decide-business-case-calc";
import { loadActor } from "@/lib/transformation-actor";
import { canReview, isVisibleTo, normalizeReviewStatus } from "@/lib/review-status";

// D05 — Business case, en option (désactivée par défaut). Appelé depuis
// l'écran de détail d'un scénario une fois un chiffrage saisi par
// l'utilisateur. Les chiffres (gain net, payback, VAN) sont calculés ici,
// côté serveur, par une fonction pure — jamais par l'IA.
const requestSchema = z.object({
  transformationId: z.string().uuid(),
  trajectoryId: z.string().uuid(),
  enabled: z.boolean(),
  capex: z.number(),
  annualGains: z.number(),
  annualCosts: z.number(),
  horizonYears: z.number().int(),
  discountRatePercent: z.number().nullable(),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in first." : "Connecte-toi d'abord." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const input = {
    capex: body.capex,
    annualGains: body.annualGains,
    annualCosts: body.annualCosts,
    horizonYears: body.horizonYears,
    discountRatePercent: body.discountRatePercent,
  };
  const errors = validateBusinessCaseInputs(input);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const result = computeBusinessCase(input);

  // RLS (owner-only, see 0011_business_case_and_validation.sql) rejects this
  // write outright if the trajectory isn't the caller's own — no extra
  // ownership check needed here.
  const { data, error } = await supabase
    .from("business_cases")
    .upsert(
      {
        transformation_id: body.transformationId,
        trajectory_id: body.trajectoryId,
        enabled: body.enabled,
        capex: input.capex,
        annual_gains: input.annualGains,
        annual_costs: input.annualCosts,
        horizon_years: input.horizonYears,
        discount_rate_percent: input.discountRatePercent,
        net_annual: result.netAnnual,
        payback_years: result.paybackYears,
        npv: result.npv,
        cumulative_by_year: result.cumulativeByYear,
      },
      { onConflict: "trajectory_id" }
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: language === "en" ? "Could not save the business case." : "Impossible d'enregistrer le business case." },
      { status: 400 }
    );
  }

  // D05 → L06 : le bénéfice net annuel calculé ci-dessus (jamais une autre
  // valeur) alimente le bénéfice attendu de Livrer, source='business_case'
  // (voir 0016_actions_and_benefits.sql). Uniquement pour la trajectoire
  // réellement retenue : un business case sur un scénario écarté ne doit
  // pas écraser le bénéfice attendu du projet. Best-effort : le business
  // case lui-même est déjà enregistré.
  let benefitLinked = false;
  const { data: tx } = await supabase
    .from("transformations")
    .select("selected_trajectory_id")
    .eq("id", body.transformationId)
    .maybeSingle();
  if (tx?.selected_trajectory_id === body.trajectoryId) {
    const { error: benefitError } = await supabase.from("benefit_expectations").upsert(
      {
        transformation_id: body.transformationId,
        expected_annual: result.netAnnual,
        source: "business_case",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "transformation_id" }
    );
    benefitLinked = !benefitError;
  }

  return NextResponse.json({ businessCase: data, result, benefitLinked });
}

// Relecture au montage (même principe que GET /api/decide/flow pour D02) :
// le dernier business case enregistré pour cette trajectoire, ou null.
// RLS limite la lecture aux projets accessibles à l'appelant.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ businessCase: null }, { status: 401 });

  const trajectoryId = new URL(request.url).searchParams.get("trajectoryId");
  if (!trajectoryId || !z.string().uuid().safeParse(trajectoryId).success) {
    return NextResponse.json({ businessCase: null });
  }

  const { data } = await supabase.from("business_cases").select("*").eq("trajectory_id", trajectoryId).maybeSingle();
  if (!data) return NextResponse.json({ businessCase: null, canReview: false, hiddenDraft: false });

  // Confiance v2 — un business case encore en brouillon (jamais relu) n'est
  // montré qu'au propriétaire / aux consultants ; le client et le CEO ne
  // voient que ce qu'un humain a marqué revu ou validé.
  const actor = await loadActor(supabase, user.id, data.transformation_id);
  const visible = isVisibleTo(actor, normalizeReviewStatus(data.review_status));
  return NextResponse.json({
    businessCase: visible ? data : null,
    canReview: canReview(actor),
    hiddenDraft: !visible,
  });
}
