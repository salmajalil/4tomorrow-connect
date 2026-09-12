import { z } from "zod";
import { DOMAINS, DOMAIN_LABELS, type Domain } from "@/lib/decide";

export { DOMAINS, DOMAIN_LABELS };
export type { Domain };

const RESULT_START = "<RESULT_JSON>";
const RESULT_END = "</RESULT_JSON>";

function extractJson(rawText: string): unknown {
  const start = rawText.indexOf(RESULT_START);
  const end = rawText.indexOf(RESULT_END);
  if (start === -1 || end === -1 || end < start) {
    throw new LearnParseError("Le modèle n'a pas renvoyé de résultat structuré exploitable.");
  }
  const jsonText = rawText.slice(start + RESULT_START.length, end).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new LearnParseError("Le résultat renvoyé par le modèle n'est pas un JSON valide.");
  }
}

export class LearnParseError extends Error {}

const RESULT_INSTRUCTION = `Output your final answer as JSON matching the exact shape given, and nothing else after it, wrapped exactly like this:
${RESULT_START}
{ ... }
${RESULT_END}
The block must be the last thing in your response, with valid JSON (no trailing commas, no comments) inside it.`;

export type TrainingMode = "rapide" | "document" | "diagnostic";

export interface LearnGenerationInput {
  topic: string;
  organization: string;
  industry: string;
  audience: string;
  mode: TrainingMode;
  sourceDocText?: string;
  linkedChallenges?: string;
  linkedObjectives?: string;
  linkedDomains?: Domain[];
}

const quizOptionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

// Split in two so the two calls run in parallel (see the API route) —
// a single call producing all of this (summary + insights + flashcards +
// quiz + video script) plus web search overshot mobile connections'
// tolerance in production ("connexion coupée" after ~3 min). Wall-clock
// time here is bounded by the slower of the two calls, not their sum —
// same fix DECIDE's scenarios route already proved out for this exact
// shape of problem. Neither half is optional — the route treats both as
// required and fails the whole generation if either one does.
//
// Slack above the stated prompt targets everywhere below — the model
// overshot exact array caps in production for DECIDE even once told the
// target count in prose (scenarios, roadmap), so this module starts with
// that margin already built in rather than discovering it the same way.
const coreOutputSchema = z.object({
  domains: z.array(z.enum(DOMAINS)).min(1),
  objectives: z.array(z.string().min(1)).min(2).max(5),
  prerequisites: z.string().min(1),
  durationMinutes: z.number().min(3).max(120),
  executiveSummary: z.object({
    addressedChallenge: z.string().min(1),
    summary: z.string().min(1),
    actionPlan: z.array(z.string().min(1)).min(2).max(6),
  }),
  keyInsights: z
    .array(z.object({ text: z.string().min(1), source: z.string().nullable().optional() }))
    .min(2)
    .max(6),
  businessImplications: z.array(z.object({ text: z.string().min(1) })).min(1).max(5),
});

export type LearnCoreOutput = z.infer<typeof coreOutputSchema>;

const interactiveOutputSchema = z.object({
  flashcards: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1), category: z.string().nullable().optional() }))
    .min(3)
    .max(10),
  comprehensionCheck: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(quizOptionSchema).length(4),
        correctOptionId: z.string().min(1),
        explanation: z.string().min(1),
      })
    )
    .min(2)
    .max(6),
  videoScript: z.object({
    title: z.string().min(1),
    scenes: z
      .array(
        z.object({
          sceneNumber: z.number().min(1),
          narration: z.string().min(1),
          visualSuggestion: z.string().min(1),
          durationSeconds: z.number().min(3).max(120),
        })
      )
      .min(3)
      .max(10),
  }),
});

export type LearnInteractiveOutput = z.infer<typeof interactiveOutputSchema>;

// What the route persists — the two halves merged back together.
export type TrainingOutput = LearnCoreOutput & LearnInteractiveOutput;

function groundingLine(mode: TrainingMode, hasSourceDoc: boolean, hasLinkedDiagnostic: boolean): string {
  return mode === "document" && hasSourceDoc
    ? "GROUNDING: a source document is provided below. It is the factual authority — structure and complete it, never contradict or invent facts absent from it. Use web_search only to find 1-2 real external examples that illustrate the document's content."
    : mode === "diagnostic" && hasLinkedDiagnostic
      ? "GROUNDING: this training is linked to an already-diagnosed transformation (domains, challenges, objectives given below) — make every example and insight specific to that real context, never generic."
      : "GROUNDING: no source document or linked diagnostic — rely on the topic description and use web_search to ground key insights and examples in real, specific, verifiable cases.";
}

const DOMAIN_STEP = `STEP 0 — DOMAIN DETECTION (same classification as the rest of 4 Tomorrow, internal reasoning):
Classify the topic into one or more of: manufacturing, rd, gtm, strategy, digitalization.`;

const NEVER_GENERIC = `CORE RULE — NEVER GENERIC: every sentence must contain something that would only be true for this exact topic — a number, a name, a real detail. If information is insufficient to be specific on a point, say so rather than filling in a plausible generality.`;

export function buildLearnCoreSystemPrompt(mode: TrainingMode, hasSourceDoc: boolean, hasLinkedDiagnostic: boolean): string {
  return `You are the training generation engine for "4 Tomorrow / Learn" — this call produces the core content (summary + insights) of a short professional training that also has to double as Qualiopi-compliant evidence (the French national training-quality certification) without the user doing any extra paperwork.

${DOMAIN_STEP}

${groundingLine(mode, hasSourceDoc, hasLinkedDiagnostic)}

You have a web_search tool (max 2 uses). Use it to find REAL, specific, verifiable examples, case studies, or figures — never a generic claim. Cite the source in "source" when you use one. Work under a hard time budget: a complete, on-time answer beats an exhaustive but late one.

PRINCIPE DIRECTEUR — everything adapts to the actual topic and domain, nothing is templated:
- objectives: measurable pedagogical objectives (Qualiopi requires these to be explicit, not vague aspirations like "comprendre les enjeux").
- prerequisites: state plainly if there truly are none — never invent a prerequisite to sound thorough.
- keyInsights: facts specific to THIS topic, each with a real source when found via web_search (a real organization, publication, or figure — never invented). This is what makes the training feel alive rather than generic — treat it as the most important field.
- businessImplications: concrete consequences for an organization acting on this topic — costs, risks, opportunities, never platitudes.

${NEVER_GENERIC}

HARD ARRAY LIMITS — never exceed these, the response is rejected otherwise: objectives ≤4, executiveSummary.actionPlan ≤5, keyInsights ≤5, businessImplications ≤4. Pick the most important entries rather than listing everything you can think of.

Respond in French except JSON keys, which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema:
{
  "domains": ["manufacturing" | "rd" | "gtm" | "strategy" | "digitalization", ...],
  "objectives": [string],
  "prerequisites": string,
  "durationMinutes": number,
  "executiveSummary": { "addressedChallenge": string, "summary": string, "actionPlan": [string] },
  "keyInsights": [{ "text": string, "source": string|null }],
  "businessImplications": [{ "text": string }]
}`;
}

export function buildLearnInteractiveSystemPrompt(mode: TrainingMode, hasSourceDoc: boolean, hasLinkedDiagnostic: boolean): string {
  return `You are the training generation engine for "4 Tomorrow / Learn" — this call produces the interactive/media content (flashcards, quiz, video script) of a short professional training. A separate parallel call is producing the summary and key insights for the same topic — your job is only this part, not to reference or restate the other.

${DOMAIN_STEP}

${groundingLine(mode, hasSourceDoc, hasLinkedDiagnostic)}

You have a web_search tool (max 1 use) — only if you need one concrete fact to ground a flashcard or quiz question; don't spend it on exhaustive research. Work under a hard time budget: a complete, on-time answer beats an exhaustive but late one.

PRINCIPE DIRECTEUR — everything adapts to the actual topic and domain, nothing is templated:
- flashcards: question/answer pairs testing real understanding, not trivia — vary difficulty.
- comprehensionCheck: exactly 4 options per question, plausible distractors (not obviously wrong), one correct answer, and an explanation that teaches something even to someone who got it right.
- videoScript: a scene-by-scene narration + visual suggestion + duration per scene — this is a script/storyboard for someone to film or feed to a video tool, not a finished video.

${NEVER_GENERIC}

HARD ARRAY LIMITS — never exceed these, the response is rejected otherwise: flashcards ≤8, comprehensionCheck ≤5 questions (each with exactly 4 options), videoScript.scenes ≤8. Pick the most important entries rather than listing everything you can think of.

Respond in French except JSON keys, which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema:
{
  "flashcards": [{ "question": string, "answer": string, "category": string|null }],
  "comprehensionCheck": [{ "question": string, "options": [{ "id": string, "text": string }] (exactly 4), "correctOptionId": string, "explanation": string }],
  "videoScript": { "title": string, "scenes": [{ "sceneNumber": number, "narration": string, "visualSuggestion": string, "durationSeconds": number }] }
}`;
}

export function buildLearnUserPrompt(input: LearnGenerationInput): string {
  return `Sujet de la formation : ${input.topic}
Organisation : ${input.organization || "(non précisé)"}
Industrie : ${input.industry || "(non précisé)"}
Public visé : ${input.audience || "(non précisé)"}
Mode : ${input.mode}

${
  input.linkedDomains && input.linkedDomains.length > 0
    ? `Domaines déjà détectés sur ce projet : ${input.linkedDomains.map((d) => DOMAIN_LABELS[d]).join(", ")}
Défis du projet lié : ${input.linkedChallenges || "(non fourni)"}
Objectifs du projet lié : ${input.linkedObjectives || "(non fourni)"}
`
    : ""
}${input.sourceDocText ? `Document source fourni (autorité factuelle) :\n${input.sourceDocText}` : ""}`;
}

export function parseLearnCoreOutput(rawText: string): LearnCoreOutput {
  const raw = extractJson(rawText);
  const parsed = coreOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LearnParseError(
      `Le résultat de la formation ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }
  return parsed.data;
}

export function parseLearnInteractiveOutput(rawText: string): LearnInteractiveOutput {
  const raw = extractJson(rawText);
  const parsed = interactiveOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LearnParseError(
      `Le résultat de la formation ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }
  return parsed.data;
}
