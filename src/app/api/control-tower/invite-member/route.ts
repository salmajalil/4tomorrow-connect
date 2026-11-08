import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { canPerform, type TransformationActor } from "@/lib/transformation-roles";
import type { Database, ModuleName } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const inviteSchema = z
  .object({
    transformationId: z.string().uuid(),
    email: z.string().trim().email(),
    role: z.enum(["consultant", "client", "expert", "ceo"]),
    domain: z.enum(["decide", "connect", "deliver", "learn"]).optional(),
  })
  .refine((body) => body.role !== "expert" || body.domain !== undefined, {
    message: "Un expert doit avoir un domaine.",
    path: ["domain"],
  });

const memberIdSchema = z.string().uuid();

// The caller's real standing on this transformation: owner of its
// organization, or an accepted member with a given role — or nobody (null:
// the transformation is invisible to them, or they have no role on it).
async function loadActor(
  supabase: SupabaseClient<Database>,
  userId: string,
  transformationId: string
): Promise<TransformationActor | null> {
  const [{ data: transformation }, { data: ownedOrgs }, { data: membership }] = await Promise.all([
    supabase.from("transformations").select("id, organization_id").eq("id", transformationId).maybeSingle(),
    supabase.from("organizations").select("id").eq("owner_id", userId),
    supabase
      .from("transformation_members")
      .select("role, domain")
      .eq("transformation_id", transformationId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .maybeSingle(),
  ]);
  if (!transformation) return null;
  const isOwner = (ownedOrgs ?? []).some((o) => o.id === transformation.organization_id);
  if (isOwner) return { role: "consultant", isOwner: true };
  if (membership) return { role: membership.role, domain: membership.domain, isOwner: false };
  return null;
}

// No email is actually sent here — there is no mailer configured anywhere
// in this codebase (src/lib/anthropic.ts is the only outbound integration).
// This endpoint only records the invitation; see the `delivered: false`
// field the client uses to show an honest "à transmettre manuellement"
// state instead of pretending a mail went out.
export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body;
  try {
    body = inviteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  // The caller's real role on this project (owner, or accepted member) —
  // the control tower now also lists projects the caller was invited to, so
  // ownership can no longer be assumed. RLS stays the safety net under this.
  const actor = await loadActor(supabase, user.id, body.transformationId);
  if (!actor || !canPerform(actor, "manage_members")) {
    return NextResponse.json({ error: language === "en" ? "Not allowed." : "Non autorisé." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("transformation_members")
    .insert({
      transformation_id: body.transformationId,
      invited_email: body.email,
      role: body.role,
      domain: body.role === "expert" ? (body.domain as ModuleName) : null,
    })
    .select("id")
    .single();

  if (error) {
    const alreadyInvited = error.code === "23505"; // unique (transformation_id, invited_email)
    return NextResponse.json(
      {
        error: alreadyInvited
          ? language === "en"
            ? "This email is already invited to this project."
            : "Cet e-mail est déjà invité sur ce projet."
          : language === "en"
            ? "Couldn't save the invitation. Try again."
            : "Impossible d'enregistrer l'invitation. Réessaie.",
      },
      { status: alreadyInvited ? 409 : 500 }
    );
  }

  return NextResponse.json({ id: data.id, delivered: false });
}

export async function DELETE(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedId = memberIdSchema.safeParse(searchParams.get("id"));
  if (!parsedId.success) {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }
  const memberId = parsedId.data;
  const notFound = () =>
    NextResponse.json({ error: language === "en" ? "Member not found." : "Membre introuvable." }, { status: 404 });

  const { data: memberRow } = await supabase
    .from("transformation_members")
    .select("transformation_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!memberRow) return notFound();

  const actor = await loadActor(supabase, user.id, memberRow.transformation_id);
  if (!actor || !canPerform(actor, "manage_members")) {
    return NextResponse.json({ error: language === "en" ? "Not allowed." : "Non autorisé." }, { status: 403 });
  }

  // .select() so a delete RLS silently filtered out (0 rows) is reported as
  // such instead of a false { ok: true }.
  const { data: deleted, error } = await supabase.from("transformation_members").delete().eq("id", memberId).select("id");
  if (error) {
    return NextResponse.json({ error: language === "en" ? "Couldn't remove this member." : "Impossible de retirer ce membre." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) return notFound();
  return NextResponse.json({ ok: true });
}
