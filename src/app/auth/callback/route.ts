import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

// Handles both the magic-link callback and email/password signup
// confirmation — Supabase sends the user back here with a `code` to
// exchange for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` comes from the URL: only a same-site path is accepted, never
  // "@evil.com" / "//evil.com" (open redirect).
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // PROJET ET ÉQUIPE — rattache à ce compte toute invitation en attente
      // adressée à son e-mail (0025_claim_pending_invitations.sql). Une
      // erreur ici ne doit jamais bloquer la connexion elle-même : au pire,
      // l'invitation reste visible et acceptable depuis la tour de contrôle.
      const { error: claimError } = await supabase.rpc("claim_pending_invitations");
      if (claimError) console.error("claim_pending_invitations failed", claimError.message);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
