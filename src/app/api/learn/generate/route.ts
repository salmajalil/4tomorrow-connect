import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildLearnSystemPrompt,
  buildLearnUserPrompt,
  parseLearnOutput,
  LearnParseError,
  type TrainingMode,
  type Domain,
} from "@/lib/learn";
import { setModuleStatus } from "@/lib/module-status";

// web_search is used in every mode (real examples/insights) — same
// headroom budget the scenarios route settled on after production timeout
// tuning, not a conservative default to be raised later.
export const maxDuration = 180;

const requestSchema = z.object({
  transformationId: z.string().uuid().nullable().optional(),
  topic: z.string().trim().min(1, "Décris le sujet de la formation."),
  audience: z.string().trim().default(""),
  mode: z.enum(["rapide", "document", "diagnostic"]),
  sourceDocText: z.string().trim().default(""),
  sourceDocName: z.string().trim().default(""),
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi pour générer une formation." }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  // Two doors, same connected project model: a transformationId reuses an
  // existing project (arriving from Decide or the Control Tower, or the
  // user picking one of their own projects at intake); none creates a
  // fresh lightweight one — same "one organization per user" pattern used
  // everywhere else, so a standalone Learn run is still a real project,
  // never an orphan.
  let transformationId = body.transformationId ?? null;
  let organizationName = body.organization;
  let industry = body.industry;
  let linkedChallenges = "";
  let linkedObjectives = "";
  let linkedDomains: string[] = [];

  if (transformationId) {
    const { data: existing } = await supabase
      .from("transformations")
      .select("id, challenges, objectives, domains, organization_id")
      .eq("id", transformationId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }
    linkedChallenges = existing.challenges ?? "";
    linkedObjectives = existing.objectives ?? "";
    linkedDomains = (existing.domains as string[]) ?? [];
    const { data: org } = await supabase
      .from("organizations")
      .select("name, industry")
      .eq("id", existing.organization_id)
      .maybeSingle();
    organizationName = org?.name ?? "";
    industry = org?.industry ?? "";
  } else {
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
        .insert({ owner_id: user.id, name: body.organization || body.industry || "Mon organisation", industry: body.industry || null })
        .select("id")
        .single();
      if (orgError) {
        return NextResponse.json({ error: "Impossible d'enregistrer la formation. Réessaie." }, { status: 500 });
      }
      organizationId = newOrg.id;
    } else {
      const { data: org } = await supabase.from("organizations").select("name, industry").eq("id", organizationId).maybeSingle();
      organizationName = org?.name ?? body.organization;
      industry = org?.industry ?? body.industry;
    }

    const { data: newTransformation, error: txError } = await supabase
      .from("transformations")
      .insert({ organization_id: organizationId, challenges: body.topic, status: "active" })
      .select("id")
      .single();
    if (txError) {
      return NextResponse.json({ error: "Impossible d'enregistrer la formation. Réessaie." }, { status: 500 });
    }
    transformationId = newTransformation.id;
  }

  const anthropic = getAnthropicClient();
  const mode: TrainingMode = body.mode;
  const system = buildLearnSystemPrompt(mode, !!body.sourceDocText, !!linkedChallenges);
  const userPrompt = buildLearnUserPrompt({
    topic: body.topic,
    organization: organizationName,
    industry,
    audience: body.audience,
    mode,
    sourceDocText: body.sourceDocText || undefined,
    linkedChallenges: linkedChallenges || undefined,
    linkedObjectives: linkedObjectives || undefined,
    linkedDomains: linkedDomains.length > 0 ? (linkedDomains as Domain[]) : undefined,
  });

  const createCall = () =>
    anthropic.messages.create({
      model: MATCHING_MODEL,
      // Generous from the start: DECIDE's scenarios/roadmap/diagnostic
      // routes all had to raise this after production truncation — a
      // training with objectives + summary + up to 5 insights + up to 8
      // flashcards + up to 5 four-option quiz questions + an 8-scene
      // video script is comparably large output.
      max_tokens: 6500,
      system,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 2 }],
    });

  let response;
  try {
    response = await createCall();
  } catch (err) {
    if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        response = await createCall();
      } catch (retryErr) {
        return handleAnthropicError(retryErr);
      }
    } else {
      return handleAnthropicError(err);
    }
  }

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let result;
  try {
    result = parseLearnOutput(rawText);
  } catch (err) {
    if (err instanceof LearnParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const { data: training, error: trainingError } = await supabase
    .from("trainings")
    .insert({
      transformation_id: transformationId,
      topic: body.topic,
      mode,
      domains: result.domains,
      audience: body.audience || null,
      objectives: result.objectives,
      prerequisites: result.prerequisites,
      duration_minutes: result.durationMinutes,
      executive_summary: result.executiveSummary,
      key_insights: result.keyInsights,
      business_implications: result.businessImplications,
      flashcards: result.flashcards,
      comprehension_check: result.comprehensionCheck,
      video_script: result.videoScript,
      source_doc_name: body.sourceDocName || null,
    })
    .select("*")
    .single();

  if (trainingError || !training) {
    return NextResponse.json({ error: "Impossible d'enregistrer la formation générée. Réessaie." }, { status: 500 });
  }

  await setModuleStatus(supabase, transformationId, "learn", "done");

  return NextResponse.json({ transformationId, training });
}

function handleAnthropicError(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
    return NextResponse.json(
      { error: "Le moteur de formation n'a pas pu répondre. Réessaie dans un instant." },
      { status }
    );
  }
  return NextResponse.json(
    { error: "Le moteur de formation a mis trop de temps à répondre. Réessaie." },
    { status: 504 }
  );
}
