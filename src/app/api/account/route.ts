import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanguage } from "@/lib/i18n/language";

// Account deletion (RGPD right to erasure). The caller's own session
// identifies who to delete — never a body-supplied id, so this can only
// ever delete the caller's own account. auth.admin.deleteUser requires the
// service-role key (src/lib/supabase/service.ts), since no RLS policy can
// let a user delete their own auth.users row directly.
//
// Every table that matters cascades from auth.users (organizations.owner_id
// on delete cascade, which in turn cascades to transformations and
// everything under them; transformation_members.user_id and ai_usage.user_id
// also cascade) — see the migrations listed in each table's own comments.
// Nothing here re-implements that cleanup; deleting the auth user is enough.
export async function DELETE() {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json(
      { error: language === "en" ? "Could not delete the account." : "Impossible de supprimer le compte." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
