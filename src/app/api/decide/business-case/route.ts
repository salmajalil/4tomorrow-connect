import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { computeBusinessCase, validateBusinessCaseInputs } from "@/lib/decide-business-case-calc";

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

  return NextResponse.json({ businessCase: data, result });
}
