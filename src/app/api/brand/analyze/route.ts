import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_DOC_LENGTH, MAX_FREE_TEXT_LENGTH } from "@/lib/input-limits";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { enforceAiQuota, getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildBrandThemeSystemPrompt,
  buildBrandThemeUserPrompt,
  parseBrandThemeOutput,
  BrandThemeParseError,
} from "@/lib/brand-theme";
import { getLanguage } from "@/lib/i18n/language";
import { streamJsonResponse } from "@/lib/streaming-json-response";
import type { BrandTheme } from "@/types/database";

export const maxDuration = 60;

const requestSchema = z
  .object({
    siteUrl: z.string().trim().min(1).max(MAX_FREE_TEXT_LENGTH).optional(),
    docText: z.string().trim().min(1).max(MAX_DOC_LENGTH).optional(),
    docName: z.string().trim().max(MAX_FREE_TEXT_LENGTH).optional(),
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

  // Daily AI quota per user and route (see assertAiQuota, src/lib/anthropic.ts).
  const quotaResponse = await enforceAiQuota(supabase, user.id, "brand/analyze", language);
  if (quotaResponse) return quotaResponse;

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
  const finalOrganizationId = organizationId;

  // The slow part (the AI call, then the save) — wrapped so the connection
  // stays visibly alive throughout instead of one long silent wait (see
  // src/lib/streaming-json-response.ts). Thrown errors below become the
  // same { error } body callers already expect.
  return streamJsonResponse(async () => {
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
        throw new Error(
          language === "en"
            ? `Couldn't analyze the brand (${err.status ?? "network"}). Try again.`
            : `Impossible d'analyser la marque (${err.status ?? "réseau"}). Réessaie.`
        );
      }
      throw new Error(
        language === "en" ? "The request took too long. Try again." : "La requête a mis trop de temps. Réessaie."
      );
    }

    let parsed;
    try {
      parsed = parseBrandThemeOutput(raw);
    } catch (err) {
      if (err instanceof BrandThemeParseError) throw new Error(err.message);
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
      .eq("id", finalOrganizationId);

    if (updateError) {
      throw new Error(
        language === "en" ? "Couldn't save the theme. Try again." : "Impossible d'enregistrer le thème. Réessaie."
      );
    }

    return { theme };
  });
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

