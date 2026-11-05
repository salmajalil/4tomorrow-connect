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
  DOMAINS,
} from "@/lib/decide";
import {
  computeCapabilityGaps,
  validateCapabilityInputs,
  CAPABILITY_LEVEL_MIN,
  CAPABILITY_LEVEL_MAX,
  type CapabilityAssessmentInput,
} from "@/lib/decide-diagnostic-calc";
import { setModuleStatus } from "@/lib/module-status";
import { getLanguage } from "@/lib/i18n/language";
import { streamJsonResponse } from "@/lib/streaming-json-response";
import type { RecommendableModule } from "@/types/database";

// web_search is opt-in (enrichWithWebSearch) — the ceiling is sized for
// that path (one search round), even though the default no-search path
// finishes in a few seconds.
export const maxDuration = 120;

const capabilityEntrySchema = z.object({
  observed: z.number().int().min(CAPABILITY_LEVEL_MIN).max(CAPABILITY_LEVEL_MAX),
  target: z.number().int().min(CAPABILITY_LEVEL_MIN).max(CAPABILITY_LEVEL_MAX),
  importance: z.number().int().min(CAPABILITY_LEVEL_MIN).max(CAPABILITY_LEVEL_MAX),
  proofNote: z.string().trim().default(""),
});

// Keyed by domain, but kept as a plain string-keyed record (not z.enum)
// so `.default({})` type-checks — an empty/missing assessment just means
// no capability_assessments rows get written this time. Unknown keys (not
// one of DOMAINS) are dropped when building capabilityInputs below, rather
// than rejecting the whole request.
const capabilitiesSchema = z.record(z.string(), capabilityEntrySchema).default({});

const requestSchema = z.object({
  organization: z.string().trim().default(""),
  industry: z.string().trim().default(""),
  challenges: z.string().trim().default(""),
  objectives: z.string().trim().default(""),
  constraints: z.string().trim().default(""),
  regulations: z.string().trim().default(""),
  uploadedDocText: z.string().trim().default(""),
  enrichWithWebSearch: z.boolean().default(false),
  capabilities: capabilitiesSchema,
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

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  // D01 — validate the structured assessment before calling the AI at all:
  // no point spending an AI call if the deterministic half is malformed.
  // Unknown keys (not a real domain) are silently dropped rather than
  // rejected — a stray/outdated key from a client shouldn't block the rest.
  const domainSet = new Set<string>(DOMAINS);
  const capabilityInputs: CapabilityAssessmentInput[] = Object.entries(body.capabilities)
    .filter(([domain]) => domainSet.has(domain))
    .map(([domain, entry]) => ({ domain: domain as (typeof DOMAINS)[number], ...entry }));
  const capabilityErrors = validateCapabilityInputs(capabilityInputs);
  if (capabilityErrors.length > 0) {
    return NextResponse.json({ error: capabilityErrors.join(" ") }, { status: 400 });
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

  // Everything from here on is the slow part (the AI call, then several
  // Supabase writes) — wrapped so the connection stays visibly alive the
  // whole time instead of one long silent wait, which is what was actually
  // producing "Load failed" on mobile (see src/lib/streaming-json-response.ts).
  // Failures below throw instead of returning NextResponse.json(); the
  // wrapper turns a thrown Error's message into the same { error } body
  // callers already expect (see parseJsonResponse).
  return streamJsonResponse(async () => {
    let response;
    try {
      response = await anthropic.messages.create({
        model: MATCHING_MODEL,
        // Raised from 3000 pre-emptively: rootCauses/decisionCriteria/weighted
        // priorities just added the same kind of extra JSON content that
        // truncated the scenarios/roadmap responses at their original budgets.
        // Left as-is here rather than trimmed further for latency — cutting
        // it back down risks reintroducing that same truncation bug, which
        // is worse than the latency it would save.
        max_tokens: 4000,
        system: buildDiagnosticSystemPrompt(language, body.enrichWithWebSearch),
        messages: [{ role: "user", content: buildDiagnosticUserPrompt(body) }],
        ...(body.enrichWithWebSearch
          ? { tools: [{ type: "web_search_20260318" as const, name: "web_search" as const, max_uses: 3 }] }
          : {}),
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(
          language === "en"
            ? "The diagnostic engine couldn't respond. Try again in a moment."
            : "Le moteur de diagnostic n'a pas pu répondre. Réessaie dans un instant."
        );
      }
      throw new Error(
        language === "en"
          ? "The diagnostic engine took too long to respond. Try again."
          : "Le moteur de diagnostic a mis trop de temps à répondre. Réessaie."
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
      if (err instanceof DecideParseError) throw new Error(err.message);
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
        throw new Error(
          language === "en" ? "Couldn't save the diagnostic. Try again." : "Impossible d'enregistrer le diagnostic. Réessaie."
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
        // Persisted so /decide can rehydrate the full diagnostic later —
        // these used to only ever live in the API response, lost the moment
        // the page was left or reloaded.
        maturity_reading: result.maturityReading,
        maturity_highlights: result.maturityHighlights,
        root_causes: result.rootCauses,
        decision_criteria: result.decisionCriteria,
        starting_recommendation: result.startingRecommendation,
        starting_actions: result.startingActions,
        status: "active",
      })
      .select("id")
      .single();

    if (transformationError) {
      throw new Error(
        language === "en" ? "Couldn't save the diagnostic. Try again." : "Impossible d'enregistrer le diagnostic. Réessaie."
      );
    }

    const transformationId: string = transformation.id;

    // D01 — the deterministic capability gaps (see
    // src/lib/decide-diagnostic-calc.ts). Computed above from the user's own
    // observed/target/importance/proofNote; the AI never sees or touches
    // these numbers.
    const capabilityGaps = computeCapabilityGaps(capabilityInputs);

    // Independent child writes, all keyed off transformationId with none
    // depending on another's result — run them together instead of one
    // after another, shaving the sequential tail off the response.
    const moduleEntries: RecommendableModule[] = ["connect", "learn", "deliver"];
    await Promise.all([
      result.gaps.length > 0
        ? supabase
            .from("gaps")
            .insert(result.gaps.map((g) => ({ transformation_id: transformationId, name: g.name, reason: g.reason })))
        : Promise.resolve(),
      result.priorities.length > 0
        ? supabase.from("priorities").insert(
            result.priorities.map((p) => ({
              transformation_id: transformationId,
              name: p.name,
              reason: p.reason,
              weight: p.weight,
            }))
          )
        : Promise.resolve(),
      result.risks.length > 0
        ? supabase
            .from("risks")
            .insert(result.risks.map((r) => ({ transformation_id: transformationId, name: r.name, reason: r.reason })))
        : Promise.resolve(),
      supabase.from("module_recommendations").insert(
        moduleEntries.map((module) => ({
          transformation_id: transformationId,
          module,
          relevance: result.moduleRecommendations[module].relevance,
          reason: result.moduleRecommendations[module].reason,
        }))
      ),
      capabilityGaps.length > 0
        ? supabase.from("capability_assessments").insert(
            capabilityGaps.map((c) => ({
              transformation_id: transformationId,
              domain: c.domain,
              observed: c.observed,
              target: c.target,
              importance: c.importance,
              gap: c.gap,
              priority: c.priority,
              status: c.status,
              proof_note: c.proofNote,
            }))
          )
        : Promise.resolve(),
      setModuleStatus(supabase, transformationId, "decide", "in_progress"),
    ]);

    return { transformationId, ...result, capabilityGaps };
  });
}
