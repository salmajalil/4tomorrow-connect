import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DOMAINS } from "@/lib/learn-skills-calc";
import { getLanguage } from "@/lib/i18n/language";

// F01 — the editable training catalog ("une formation proposée par
// écart"): a plain CRUD list scoped to the user's own organization, never
// generated or altered by the AI. A domain with no row here falls back to
// DEFAULT_TRAINING_SUGGESTIONS in src/lib/learn-skills-calc.ts, both
// client- and server-side.

async function getOwnOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("organizations").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  const organizationId = await getOwnOrganizationId(supabase, user.id);
  if (!organizationId) {
    return NextResponse.json({ suggestions: [] });
  }

  const { data } = await supabase
    .from("training_suggestions")
    .select("domain, suggestion")
    .eq("organization_id", organizationId);

  return NextResponse.json({ suggestions: data ?? [] });
}

const putSchema = z.object({
  domain: z.enum(DOMAINS),
  suggestion: z.string().trim().min(1),
});

export async function PUT(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  let organizationId = await getOwnOrganizationId(supabase, user.id);
  if (!organizationId) {
    const { data: newOrg, error } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, name: "Mon organisation" })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json(
        { error: language === "en" ? "Couldn't save." : "Impossible d'enregistrer." },
        { status: 500 }
      );
    }
    organizationId = newOrg.id;
  }

  const { error } = await supabase
    .from("training_suggestions")
    .upsert({ organization_id: organizationId, domain: body.domain, suggestion: body.suggestion }, { onConflict: "organization_id,domain" });

  if (error) {
    return NextResponse.json({ error: language === "en" ? "Couldn't save." : "Impossible d'enregistrer." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ domain: z.enum(DOMAINS) });

export async function DELETE(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const organizationId = await getOwnOrganizationId(supabase, user.id);
  if (!organizationId) {
    return NextResponse.json({ ok: true });
  }

  await supabase.from("training_suggestions").delete().eq("organization_id", organizationId).eq("domain", body.domain);

  return NextResponse.json({ ok: true });
}
