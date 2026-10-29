import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildBrandThemeSystemPrompt,
  buildBrandThemeUserPrompt,
  parseBrandThemeOutput,
  BrandThemeParseError,
} from "@/lib/brand-theme";
import { getLanguage } from "@/lib/i18n/language";
import type { BrandTheme } from "@/types/database";

export const maxDuration = 60;

const requestSchema = z
  .object({
    siteUrl: z.string().trim().min(1).optional(),
    docText: z.string().trim().min(1).optional(),
    docName: z.string().trim().optional(),
  })
  .refine((v) => !!v.siteUrl || !!v.docText, { message: "siteUrl ou docText requis" });

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

  // Same "one organization per user" lookup used everywhere else — the
  // brand theme attaches to that one org record, not to a specific project.
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data: newOrg, error: orgError } = await supabase
      .from("organizations")
      .insert({ owner_id: user.id, name: body.siteUrl || body.docName || "Mon organisation" })
      .select("id")
      .single();
    if (orgError) {
      return NextResponse.json(
        { error: language === "en" ? "Couldn't save the theme. Try again." : "Impossible d'enregistrer le thème. Réessaie." },
        { status: 500 }
      );
    }
    organizationId = newOrg.id;
  }

  const anthropic = getAnthropicClient();
  const hasSite = !!body.siteUrl;
  const system = buildBrandThemeSystemPrompt(hasSite);
  const userPrompt = buildBrandThemeUserPrompt(body);

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userPrompt }],
      ...(hasSite ? { tools: [{ type: "web_search_20260318" as const, name: "web_search", max_uses: 3 }] } : {}),
    });
    raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error:
            language === "en"
              ? `Couldn't analyze the brand (${err.status ?? "network"}). Try again.`
              : `Impossible d'analyser la marque (${err.status ?? "réseau"}). Réessaie.`,
        },
        { status: err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502) }
      );
    }
    return NextResponse.json(
      { error: language === "en" ? "The request took too long. Try again." : "La requête a mis trop de temps. Réessaie." },
      { status: 504 }
    );
  }

  let parsed;
  try {
    parsed = parseBrandThemeOutput(raw);
  } catch (err) {
    if (err instanceof BrandThemeParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const theme: BrandTheme = {
    ...parsed,
    sourceLabel: body.siteUrl || body.docName || "",
    generatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ brand_theme: theme })
    .eq("id", organizationId);

  if (updateError) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't save the theme. Try again." : "Impossible d'enregistrer le thème. Réessaie." },
      { status: 500 }
    );
  }

  return NextResponse.json({ theme });
}

// Clears the saved brand theme so the app reverts to 4 Tomorrow's default.
export async function DELETE() {
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (org) {
    await supabase.from("organizations").update({ brand_theme: null }).eq("id", org.id);
  }

  return NextResponse.json({ ok: true });
}

