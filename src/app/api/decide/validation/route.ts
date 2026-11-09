import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { computeExpiresAt } from "@/lib/validation-token";
import { fetchDecisionHash } from "@/lib/decision-hash";

// L09 — émission d'un lien de validation CEO : jeton à usage unique, 72h,
// lié à la décision (trajectoire sélectionnée) ET à sa version
// (transformations.decision_updated_at au moment de l'émission). Réservé au
// propriétaire du projet (RLS owner-only) — le destinataire du lien, lui,
// n'a pas de compte : voir src/app/api/validate/[token]/route.ts.
const requestSchema = z.object({ transformationId: z.string().uuid() });

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

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

  const { data: tx } = await supabase
    .from("transformations")
    .select("id, selected_trajectory_id, decision_updated_at")
    .eq("id", body.transformationId)
    .maybeSingle();

  if (!tx) {
    return NextResponse.json(
      { error: language === "en" ? "Project not found." : "Projet introuvable." },
      { status: 404 }
    );
  }
  if (!tx.selected_trajectory_id) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Choose a trajectory before sending it for CEO validation."
            : "Choisissez une trajectoire avant de l'envoyer en validation au CEO.",
      },
      { status: 400 }
    );
  }

  // Empreinte SHA-256 de la décision telle qu'elle part chez le CEO
  // (src/lib/decision-hash.ts) — recalculée à la consommation pour refuser
  // un lien dont la décision a été modifiée depuis l'envoi.
  const decisionHash = await fetchDecisionHash(supabase, tx);

  const issuedAt = new Date();
  const { data: tokenRow, error } = await supabase
    .from("ceo_validation_tokens")
    .insert({
      transformation_id: tx.id,
      trajectory_id: tx.selected_trajectory_id,
      decision_snapshot: tx.decision_updated_at,
      decision_hash: decisionHash,
      token: generateToken(),
      expires_at: computeExpiresAt(issuedAt),
    })
    .select("token, expires_at")
    .single();

  if (error || !tokenRow) {
    return NextResponse.json(
      { error: language === "en" ? "Could not issue the validation link." : "Impossible de générer le lien de validation." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/validate/${tokenRow.token}`,
    expiresAt: tokenRow.expires_at,
  });
}

// Historique des jetons déjà émis pour ce projet — alimente la "vue bilan"
// (section Impact) : qui a reçu un lien, quand, pour quelle décision,
// résultat. Toujours scopé par RLS owner-only, jamais listé publiquement.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ history: [] }, { status: 401 });

  const transformationId = new URL(request.url).searchParams.get("transformationId");
  if (!transformationId) return NextResponse.json({ history: [] });

  const { data } = await supabase
    .from("ceo_validation_tokens")
    .select("id, trajectory_id, decision_snapshot, decision_hash, expires_at, used_at, outcome, outcome_note, created_at")
    .eq("transformation_id", transformationId)
    .order("created_at", { ascending: false });

  // État actuel de la décision — permet à l'écran de distinguer un jeton
  // encore « en attente » d'un jeton périmé (décision modifiée depuis
  // l'envoi), via isTokenStillUsable (src/lib/validation-token.ts).
  const { data: tx } = await supabase
    .from("transformations")
    .select("id, selected_trajectory_id, decision_updated_at")
    .eq("id", transformationId)
    .maybeSingle();

  // L'empreinte courante est calculée ici, côté serveur (node:crypto), et
  // transmise à l'écran : il peut ainsi marquer « périmé » un lien dont le
  // contenu de la décision a changé, même trajectoire et même version.
  const decisionHash = tx ? await fetchDecisionHash(supabase, tx) : null;

  return NextResponse.json({
    history: data ?? [],
    current: tx
      ? {
          transformationId: tx.id,
          trajectoryId: tx.selected_trajectory_id,
          decisionUpdatedAt: tx.decision_updated_at,
          decisionHash,
        }
      : null,
  });
}
