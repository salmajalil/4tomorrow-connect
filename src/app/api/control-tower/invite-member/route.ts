import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { canPerform } from "@/lib/transformation-roles";
import type { ModuleName } from "@/types/database";

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

  // Only the owner can reach this today (control-tower only lists the
  // caller's own projects — see src/lib/control-tower.ts), so ownership is
  // implicit; canPerform is still called explicitly so the rule lives in
  // one place and this route fails the same way any future caller would.
  const allowed = canPerform({ role: "consultant", isOwner: true }, "manage_members");
  if (!allowed) {
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
  const memberId = searchParams.get("id");
  if (!memberId) {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const { error } = await supabase.from("transformation_members").delete().eq("id", memberId);
  if (error) {
    return NextResponse.json({ error: language === "en" ? "Couldn't remove this member." : "Impossible de retirer ce membre." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
