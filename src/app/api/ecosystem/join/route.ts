import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";

const joinSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  type: z.string().trim().min(1, "Le type est requis.").max(200),
  website: z.string().trim().max(500).optional(),
  description: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to join the ecosystem." : "Connecte-toi pour rejoindre l'écosystème." },
      { status: 401 }
    );
  }

  let body;
  try {
    body = joinSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  // Moderated: the row is created with status 'pending' (DB default, and
  // the only value RLS accepts on insert — see
  // 0024_ecosystem_members_moderation.sql). It only reaches the shared
  // "living directory" re-injected into every user's prompts (match,
  // decide/scenarios) once manually marked 'approved'.
  const { data, error } = await supabase
    .from("ecosystem_members")
    .insert({
      created_by: user.id,
      name: body.name,
      type: body.type,
      website: body.website || null,
      description: body.description || null,
      contact: body.contact || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't save your contribution. Try again."
            : "Impossible d'enregistrer ta contribution. Réessaie.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}
