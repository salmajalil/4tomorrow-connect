import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const joinSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  type: z.string().trim().min(1, "Le type est requis."),
  website: z.string().trim().optional(),
  description: z.string().trim().optional(),
  contact: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connecte-toi pour rejoindre l'écosystème." },
      { status: 401 }
    );
  }

  let body;
  try {
    body = joinSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  // No manual validation step by design — this insert is what feeds the
  // "living directory" re-injected into every future matching run (see
  // src/lib/matching.ts).
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
      { error: "Impossible d'enregistrer ta contribution. Réessaie." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}
