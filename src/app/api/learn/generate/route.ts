import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildLearnCoreSystemPrompt,
  buildLearnInteractiveSystemPrompt,
  buildWorkshopSystemPrompt,
  buildLearnUserPrompt,
  parseLearnCoreOutput,
  parseLearnInteractiveOutput,
  parseWorkshopOutput,
  LearnParseError,
  type TrainingMode,
  type TrainingOutput,
  type WorkshopOutput,
  type Domain,
} from "@/lib/learn";
import { setModuleStatus } from "@/lib/module-status";
import type { Training } from "@/types/database";
import { getLanguage } from "@/lib/i18n/language";

// web_search is used in every mode (real examples/insights) — same
// headroom budget the scenarios route settled on after production timeout
// tuning, not a conservative default to be raised later.
export const maxDuration = 180;

class LearnMaxTokensError extends Error {}

// One call producing everything (summary + insights + flashcards + quiz +
// video script) took long enough in production for mobile connections to
// drop mid-flight ("connexion coupée" after several minutes) — 16000
// max_tokens fixed the earlier truncation bug but made that worse, since
// more budget means the model can legitimately spend more time generating.
// Split into two smaller parallel calls instead (same fix DECIDE's
// scenarios route already proved for this exact shape of problem): total
// wall-clock is bounded by the slower of the two, not their sum.
async function runLearnCompletion(
  anthropic: Anthropic,
  system: string,
  userPrompt: string,
  maxTokens: number,
  webSearchMaxUses: number
): Promise<string> {
  const createCall = () =>
    anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ type: "web_search_20260318", name: "web_search", max_uses: webSearchMaxUses }],
    });

  let response;
  try {
    response = await createCall();
  } catch (err) {
    if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      response = await createCall();
    } else {
      throw err;
    }
  }

  if (response.stop_reason === "max_tokens") {
    throw new LearnMaxTokensError();
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

const requestSchema = z.object({
  transformationId: z.string().uuid().nullable().optional(),
  topic: z.string().trim().min(1, "Décris le sujet de la formation."),
  audience: z.string().trim().default(""),
  mode: z.enum(["rapide", "document", "diagnostic", "workshop"]),
  sourceDocText: z.string().trim().default(""),
  sourceDocName: z.string().trim().default(""),
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to generate a training." : "Connecte-toi pour générer une formation." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
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
      return NextResponse.json(
        { error: language === "en" ? "Project not found." : "Projet introuvable." },
        { status: 404 }
      );
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
        return NextResponse.json(
          { error: language === "en" ? "Couldn't save the training. Try again." : "Impossible d'enregistrer la formation. Réessaie." },
          { status: 500 }
        );
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
      return NextResponse.json(
        { error: language === "en" ? "Couldn't save the training. Try again." : "Impossible d'enregistrer la formation. Réessaie." },
        { status: 500 }
      );
    }
    transformationId = newTransformation.id;
  }

  const anthropic = getAnthropicClient();
  const mode: TrainingMode = body.mode;
  const hasLinkedDiagnostic = !!linkedChallenges;
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

  function maxTokensResponse() {
    // Distinct from a parse failure — the model was cut off mid-answer.
    // Surfacing this separately (instead of falling into the generic
    // LearnParseError message below) makes a real future regression
    // diagnosable from the error text alone, without a Vercel log dive.
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Generation was interrupted before completion (content too long). Try again, ideally with a more focused topic."
            : "La génération a été interrompue avant la fin (contenu trop long). Réessaie, idéalement avec un sujet plus ciblé.",
      },
      { status: 502 }
    );
  }

  function saveFailedResponse() {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't save the generated training. Try again."
            : "Impossible d'enregistrer la formation générée. Réessaie.",
      },
      { status: 500 }
    );
  }

  let trainingRow: Partial<Training> & Pick<Training, "transformation_id" | "topic">;

  if (mode === "workshop") {
    const workshopSystem = buildWorkshopSystemPrompt(hasLinkedDiagnostic, language);

    let workshopRaw: string;
    try {
      workshopRaw = await runLearnCompletion(anthropic, workshopSystem, userPrompt, 8000, 1);
    } catch (err) {
      if (err instanceof LearnMaxTokensError) return maxTokensResponse();
      return handleAnthropicError(err, language);
    }

    let result: WorkshopOutput;
    try {
      result = parseWorkshopOutput(workshopRaw);
    } catch (err) {
      if (err instanceof LearnParseError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }

    trainingRow = {
      transformation_id: transformationId,
      topic: body.topic,
      mode,
      domains: result.domains,
      audience: body.audience || null,
      objectives: result.objectives,
      prerequisites: result.prerequisites,
      duration_minutes: result.durationMinutes,
      executive_summary: { addressedChallenge: "", summary: "", actionPlan: [] },
      key_insights: [],
      business_implications: [],
      flashcards: [],
      comprehension_check: [],
      video_script: { title: "", scenes: [] },
      source_doc_name: body.sourceDocName || null,
      workshop_intro: result.workshopIntro,
      workshop_support: result.workshopSupport,
      workshop_steps: result.workshopSteps,
    };
  } else {
    const coreSystem = buildLearnCoreSystemPrompt(mode, !!body.sourceDocText, hasLinkedDiagnostic, language);
    const interactiveSystem = buildLearnInteractiveSystemPrompt(mode, !!body.sourceDocText, hasLinkedDiagnostic, language);

    let coreRaw: string;
    let interactiveRaw: string;
    try {
      [coreRaw, interactiveRaw] = await Promise.all([
        runLearnCompletion(anthropic, coreSystem, userPrompt, 6000, 2),
        runLearnCompletion(anthropic, interactiveSystem, userPrompt, 10000, 1),
      ]);
    } catch (err) {
      if (err instanceof LearnMaxTokensError) return maxTokensResponse();
      return handleAnthropicError(err, language);
    }

    let result: TrainingOutput;
    try {
      result = { ...parseLearnCoreOutput(coreRaw), ...parseLearnInteractiveOutput(interactiveRaw) };
    } catch (err) {
      if (err instanceof LearnParseError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }

    trainingRow = {
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
      workshop_intro: null,
      workshop_support: null,
      workshop_steps: null,
    };
  }

  const { data: training, error: trainingError } = await supabase
    .from("trainings")
    .insert(trainingRow)
    .select("*")
    .single();

  if (trainingError || !training) {
    return saveFailedResponse();
  }

  await setModuleStatus(supabase, transformationId, "learn", "done");

  return NextResponse.json({ transformationId, training });
}

function handleAnthropicError(err: unknown, language: "fr" | "en") {
  if (err instanceof Anthropic.APIError) {
    const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
    // Include the real status/message in the user-facing error — the app
    // has no admin log viewer, so a screenshot of this is the only way to
    // diagnose a production failure without a Vercel dashboard detour.
    const detail =
      language === "en"
        ? `${err.status ?? "network"} — ${err.message ?? "unknown error"}`.slice(0, 200)
        : `${err.status ?? "réseau"} — ${err.message ?? "erreur inconnue"}`.slice(0, 200);
    return NextResponse.json(
      {
        error:
          language === "en"
            ? `The training engine couldn't respond (${detail}). Try again in a moment.`
            : `Le moteur de formation n'a pas pu répondre (${detail}). Réessaie dans un instant.`,
      },
      { status }
    );
  }
  return NextResponse.json(
    {
      error:
        language === "en"
          ? "The training engine took too long to respond. Try again."
          : "Le moteur de formation a mis trop de temps à répondre. Réessaie.",
    },
    { status: 504 }
  );
}
