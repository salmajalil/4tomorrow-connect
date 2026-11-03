import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import {
  computeSupplierAssessment,
  validateSupplierInputs,
  type SupplierCriterion,
  type SupplierPrerequisite,
} from "@/lib/connect-supplier-calc";

// C02 — pertinence fournisseur : reçoit les prérequis/critères saisis par
// l'utilisateur pour un match donné, calcule éligibilité/score/recommandé
// côté serveur (src/lib/connect-supplier-calc.ts, pur, jamais l'IA) et
// persiste le tout. Aucun appel IA dans cette route.
const prerequisiteSchema = z.object({
  label: z.string().trim().min(1),
  met: z.boolean(),
});

const criterionSchema = z.object({
  label: z.string().trim().min(1),
  score: z.number().int().min(1).max(5).nullable(),
  proofStatus: z.enum(["vérifié", "manquant", "périmé"]),
  proofDate: z.string().trim().nullable(),
});

const requestSchema = z.object({
  matchId: z.string().uuid(),
  transformationId: z.string().uuid(),
  prerequisites: z.array(prerequisiteSchema).default([]),
  criteria: z.array(criterionSchema).default([]),
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
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const prerequisites: SupplierPrerequisite[] = body.prerequisites;
  const criteria: SupplierCriterion[] = body.criteria;

  const errors = validateSupplierInputs(prerequisites, criteria);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const result = computeSupplierAssessment(prerequisites, criteria);

  // RLS (supplier_assessments_insert_own / _update_own) already rejects this
  // if the caller doesn't own the transformation behind matchId — the
  // explicit ownership check here is just a clearer 404 than a bare RLS
  // denial would give.
  const { error: upsertError } = await supabase.from("supplier_assessments").upsert(
    {
      match_id: body.matchId,
      transformation_id: body.transformationId,
      prerequisites,
      criteria,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );

  if (upsertError) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't save this assessment. Try again."
            : "Impossible d'enregistrer cette évaluation. Réessaie.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ result });
}
