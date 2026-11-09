import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { loadActor } from "@/lib/transformation-actor";
import { evaluateReviewTransition, normalizeReviewStatus } from "@/lib/review-status";

// Confiance v2 — « Marquer comme revu » / « Valider » sur un livrable clé
// (executive report, business case). Geste humain explicite, jamais
// déclenché par l'IA : la route ne fait que vérifier le rôle de l'appelant
// (canPerform(actor, "review_deliverable"), via evaluateReviewTransition)
// et la transition (un cran à la fois), puis écrit les colonnes de revue.
// La RLS update (propriétaire) reste le filet de sécurité sous ce contrôle.
const requestSchema = z.object({
  target: z.enum(["deliverable", "business_case"]),
  id: z.string().uuid(),
  status: z.enum(["reviewed", "validated"]),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const r = getDictionary(language).trust.review;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const table = body.target === "deliverable" ? "deliverables" : "business_cases";
  const { data: row } = await supabase
    .from(table)
    .select("id, transformation_id, review_status")
    .eq("id", body.id)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: r.notFound }, { status: 404 });
  }

  const actor = await loadActor(supabase, user.id, row.transformation_id);
  const current = normalizeReviewStatus(row.review_status);
  const verdict = evaluateReviewTransition(actor, current, body.status);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: verdict.code === "not_allowed" ? r.notAllowed : r.invalidTransition },
      { status: verdict.code === "not_allowed" ? 403 : 409 }
    );
  }

  const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const reviewerName = metadataName || user.email || null;
  const { data: updated, error } = await supabase
    .from(table)
    .update({
      review_status: body.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by_name: reviewerName,
    })
    .eq("id", row.id)
    // Garde-fou contre une double revue concurrente : n'écrit que si le
    // statut n'a pas bougé depuis la lecture ci-dessus.
    .eq("review_status", current)
    .select("id, review_status, reviewed_by, reviewed_at, reviewed_by_name")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: r.saveError }, { status: 409 });
  }

  return NextResponse.json({ review: updated });
}
