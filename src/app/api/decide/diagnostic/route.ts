import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildDiagnosticSystemPrompt,
  buildDiagnosticUserPrompt,
  parseDiagnosticOutput,
  DecideParseError,
  type DiagnosticInput,
} from "@/lib/decide";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";
import type { RecommendableModule } from "@/types/database";

// No web_search in this call — pure reasoning, so a generous ceiling here
// is just a safety net, not an expected duration.
export const maxDuration = 60;

const requestSchema = z.object({
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  challenges: z.string().trim().default(""),
  objectives: z.string().trim().default(""),
  constraints: z.string().trim().default(""),
  regulations: z.string().trim().default(""),
  uploadedDocText: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to launch a diagnostic." : "Connecte-toi pour lancer un diagnostic." },
      { status: 401 }
    );
  }

  let body: DiagnosticInput;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  if (!body.challenges && !body.objectives && !body.uploadedDocText) {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Describe at least your challenges or objectives to launch the diagnostic."
            : "Décris au moins tes défis ou tes objectifs pour lancer le diagnostic.",
      },
      { status: 400 }
    );
  }

  const anthropic = getAnthropicClient();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      // Raised from 3000 pre-emptively: rootCauses/decisionCriteria/weighted
      // priorities just added the same kind of extra JSON content that
      // truncated the scenarios/roadmap responses at their original budgets.
      max_tokens: 4000,
      system: buildDiagnosticSystemPrompt(language),
      messages: [{ role: "user", content: buildDiagnosticUserPrompt(body) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
      return NextResponse.json(
        {
          error:
            language === "en"
              ? "The diagnostic engine couldn't respond. Try again in a moment."
              : "Le moteur de diagnostic n'a pas pu répondre. Réessaie dans un instant.",
        },
        { status }
      );
    }
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "The diagnostic engine took too long to respond. Try again."
            : "Le moteur de diagnostic a mis trop de temps à répondre. Réessaie.",
      },
      { status: 504 }
    );
  }

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let result;
  try {
    result = parseDiagnosticOutput(rawText);
  } catch (err) {
    if (err instanceof DecideParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  // Persist. Same "one organization per user" pattern as CONNECT.
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
      .insert({
        owner_id: user.id,
        name: body.organization || body.industry || "Mon organisation",
        industry: body.industry || null,
      })
      .select("id")
      .single();
    if (orgError) {
      return NextResponse.json(
        { error: language === "en" ? "Couldn't save the diagnostic. Try again." : "Impossible d'enregistrer le diagnostic. Réessaie." },
        { status: 500 }
      );
    }
    organizationId = newOrg.id;
  }

  const { data: transformation, error: transformationError } = await supabase
    .from("transformations")
    .insert({
      organization_id: organizationId,
      challenges: body.challenges || null,
      objectives: body.objectives || null,
      constraints: body.constraints || null,
      domains: result.domains,
      status: "active",
    })
    .select("id")
    .single();

  if (transformationError) {
    return NextResponse.json(
      { error: language === "en" ? "Couldn't save the diagnostic. Try again." : "Impossible d'enregistrer le diagnostic. Réessaie." },
      { status: 500 }
    );
  }

  const transformationId: string = transformation.id;

  if (result.gaps.length > 0) {
    await supabase.from("gaps").insert(
      result.gaps.map((g) => ({ transformation_id: transformationId, name: g.name, reason: g.reason }))
    );
  }
  if (result.priorities.length > 0) {
    await supabase.from("priorities").insert(
      result.priorities.map((p) => ({ transformation_id: transformationId, name: p.name, reason: p.reason }))
    );
  }
  if (result.risks.length > 0) {
    await supabase.from("risks").insert(
      result.risks.map((r) => ({ transformation_id: transformationId, name: r.name, reason: r.reason }))
    );
  }

  const moduleEntries: RecommendableModule[] = ["connect", "learn", "deliver"];
  await supabase.from("module_recommendations").insert(
    moduleEntries.map((module) => ({
      transformation_id: transformationId,
      module,
      relevance: result.moduleRecommendations[module].relevance,
      reason: result.moduleRecommendations[module].reason,
    }))
  );

  await setModuleStatus(supabase, transformationId, "decide", "in_progress");

  return NextResponse.json({ transformationId, ...result });
}
