import { z } from "zod";
import { DOMAINS, DOMAIN_LABELS, type Domain } from "@/lib/decide";
import { DELIVERABLE_KINDS, type DeliverableKind, type DeliverableContent, type RecalibrationSummary } from "@/types/database";

export { DOMAINS, DOMAIN_LABELS, DELIVERABLE_KINDS };
export type { Domain, DeliverableKind };

// Fixed, literal UI labels — reproduced exactly from the reference product,
// never translated or domain-adapted (unlike every other adaptive surface
// in 4 Tomorrow). The generated content inside each deliverable (and its
// own "title" field) still adapts to the domain — only these six card/tab
// labels are constant.
export const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  roadmap: "Transformation Roadmap",
  action_plan: "Action Plan",
  kpi_dashboard: "KPI Dashboard",
  risk_map: "Risk Map",
  executive_report: "Executive Report",
  toolkit: "Project Toolkit",
};

const RESULT_START = "<RESULT_JSON>";
const RESULT_END = "</RESULT_JSON>";

function extractJson(rawText: string): unknown {
  const start = rawText.indexOf(RESULT_START);
  const end = rawText.indexOf(RESULT_END);
  if (start === -1 || end === -1 || end < start) {
    throw new DeliverParseError("Le modèle n'a pas renvoyé de résultat structuré exploitable.");
  }
  const jsonText = rawText.slice(start + RESULT_START.length, end).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new DeliverParseError("Le résultat renvoyé par le modèle n'est pas un JSON valide.");
  }
}

export class DeliverParseError extends Error {}

const RESULT_INSTRUCTION = `Output your final answer as JSON matching the exact shape given, and nothing else after it, wrapped exactly like this:
${RESULT_START}
{ ... }
${RESULT_END}
The block must be the last thing in your response, with valid JSON (no trailing commas, no comments) inside it.`;

export interface DeliverGenerationContext {
  domains: Domain[];
  organization: string;
  industry: string;
  challenges: string;
  objectives: string;
  trajectoryName: string;
  trajectoryStance: string;
  trajectoryDescription: string;
  executiveBriefing: string;
  techStack: { name: string; detail?: string; benefit?: string }[];
  indicators: Record<string, string>;
  gaps: { name: string; reason: string }[];
  priorities: { name: string; reason: string }[];
  sourceDocText?: string;
}

// Slack above the stated prompt targets everywhere below — same rationale
// as every other module: the model overshot exact array caps in production
// even once told the target count in prose.
const roadmapContentSchema = z.object({
  phases: z
    .array(
      z.object({
        phaseName: z.string().min(1),
        detailedActions: z.array(z.string().min(1)).min(1).max(7),
        dependencies: z.array(z.string().min(1)).min(0).max(5),
        ownerSuggestion: z.string().min(1),
      })
    )
    .min(1)
    .max(6),
});

const actionPlanContentSchema = z.object({
  actions: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        ownerSuggestion: z.string().min(1),
        timeframe: z.string().min(1),
      })
    )
    .min(2)
    .max(8),
});

const kpiDashboardContentSchema = z.object({
  kpis: z
    .array(
      z.object({
        name: z.string().min(1),
        target: z.string().min(1),
        current: z.string().nullable().optional(),
        unit: z.string().min(1),
        source: z.enum(["trajectory", "estimate"]),
      })
    )
    .min(2)
    .max(8),
});

const riskMapContentSchema = z.object({
  risks: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        likelihood: z.enum(["low", "medium", "high"]),
        impact: z.enum(["low", "medium", "high"]),
        mitigation: z.string().min(1),
      })
    )
    .min(2)
    .max(8),
});

const executiveReportContentSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2).max(8),
});

const toolkitContentSchema = z.object({
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        purpose: z.string().min(1),
        whyThisProject: z.string().min(1),
      })
    )
    .min(2)
    .max(7),
});

const CONTENT_SCHEMAS = {
  roadmap: roadmapContentSchema,
  action_plan: actionPlanContentSchema,
  kpi_dashboard: kpiDashboardContentSchema,
  risk_map: riskMapContentSchema,
  executive_report: executiveReportContentSchema,
  toolkit: toolkitContentSchema,
} as const;

// A generated deliverable also carries its own domain-adapted "title" (the
// GTM-plan-vs-roadmap kind of naming) — distinct from the fixed card label
// in DELIVERABLE_LABELS above, which never changes.
const deliverableOutputSchema = z.object({
  title: z.string().min(1),
  content: z.unknown(),
});

const KIND_INSTRUCTIONS: Record<DeliverableKind, string> = {
  roadmap: `Produce a DETAILED EXECUTION VERSION of the already-chosen roadmap phases given below — same phase names and sequence, do not invent a new sequence or rename phases. For each phase: detailedActions (granular execution steps beyond the high-level ones already listed), dependencies (what must be true/done before this phase can start — internal or external), ownerSuggestion (what role/function should own this phase, e.g. "Responsable production" — never a named individual).`,
  action_plan: `Concrete, short-term actions to start executing the chosen trajectory now. Each action: title, description (specific and actionable, never "improve X"), ownerSuggestion (role/function, not a named individual), timeframe (e.g. "Semaine 1-2", "Ce mois-ci").`,
  kpi_dashboard: `Build a KPI dashboard STRICTLY FROM the trajectory's own indicators given below — do not invent new, disconnected metrics. For each indicator you're given, produce one kpi entry: name (the indicator's own name), target (the indicator's own value if verified, or a reasonable near-term target framed clearly as such), current (the current state if inferable, else null), unit, source ("trajectory" if it comes directly from a given indicator, "estimate" only if you had to add a plausible operational KPI absent from the list — use "estimate" sparingly, at most 1-2 entries).`,
  risk_map: `Execution risks specific to actually RUNNING this project — distinct from the trajectory's own strategic risks given below (do not just repeat them; think about implementation, adoption, resourcing, timing risks instead). Each risk: name, description, likelihood (low/medium/high), impact (low/medium/high), mitigation (a concrete counter-measure, never "monitor closely").`,
  executive_report: `A board-level synthesis of the chosen trajectory and its execution plan: summary (one dense paragraph — what's being done, why, and the expected outcome) + keyPoints (the handful of facts a director would want to know before signing off).`,
  toolkit: `Recommend practical tools/templates/frameworks that genuinely fit THIS project — a specific tracker type, a governance template, a specific methodology — never a generic "use a project management tool" list. Each tool: name, purpose, whyThisProject (why this specific project needs exactly this, not a generality).`,
};

const KIND_SCHEMA_BLOCK: Record<DeliverableKind, string> = {
  roadmap: `{ "phases": [{ "phaseName": string, "detailedActions": [string], "dependencies": [string], "ownerSuggestion": string }] }`,
  action_plan: `{ "actions": [{ "title": string, "description": string, "ownerSuggestion": string, "timeframe": string }] }`,
  kpi_dashboard: `{ "kpis": [{ "name": string, "target": string, "current": string|null, "unit": string, "source": "trajectory" | "estimate" }] }`,
  risk_map: `{ "risks": [{ "name": string, "description": string, "likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "mitigation": string }] }`,
  executive_report: `{ "summary": string, "keyPoints": [string] }`,
  toolkit: `{ "tools": [{ "name": string, "purpose": string, "whyThisProject": string }] }`,
};

export function buildDeliverableSystemPrompt(kind: DeliverableKind): string {
  return `You are the execution engine for "4 Tomorrow / Deliver" — this call produces exactly ONE deliverable, "${DELIVERABLE_LABELS[kind]}", for a transformation whose strategic trajectory has already been chosen and diagnosed by an earlier module (Decide). You are NOT choosing a strategy — you are turning an already-chosen one into an executable document.

STEP 0 — DOMAIN AWARENESS (internal reasoning): the domain(s) are given below — adapt vocabulary and content to fit (e.g. production/technical framing for manufacturing, commercial framing for go-to-market), never a generic template.

${KIND_INSTRUCTIONS[kind]}

CORE RULE — NEVER GENERIC: every sentence must contain something that would only be true for this exact project — a number, a name, a real constraint from the context given below. Ground everything in the trajectory/context provided; do not invent facts absent from it.

Also produce a "title" for this deliverable — a short, specific, domain-adapted name for it (e.g. "Go-to-market Plan — Lancement gamme XYZ" for a commercial trajectory rather than a generic "Roadmap"). This title is shown once the deliverable is opened — it is separate from and does not replace the fixed section name.

Respond in French except JSON keys, which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema:
{ "title": string, "content": ${KIND_SCHEMA_BLOCK[kind]} }`;
}

export function buildDeliverableUserPrompt(context: DeliverGenerationContext): string {
  return `Domaines détectés : ${context.domains.map((d) => DOMAIN_LABELS[d]).join(", ")}
Organisation : ${context.organization || "(non précisé)"}
Industrie : ${context.industry || "(non précisé)"}
Défis : ${context.challenges || "(non fourni)"}
Objectifs : ${context.objectives || "(non fourni)"}

Trajectoire choisie : ${context.trajectoryName} (posture : ${context.trajectoryStance})
Description : ${context.trajectoryDescription}
Briefing exécutif : ${context.executiveBriefing}
Stack / solutions : ${context.techStack.map((t) => `${t.name}${t.detail ? ` — ${t.detail}` : ""}${t.benefit ? ` (bénéfice : ${t.benefit})` : ""}`).join("; ") || "(non fourni)"}
Indicateurs de la trajectoire : ${JSON.stringify(context.indicators)}

Gaps identifiés : ${context.gaps.map((g) => `${g.name} — ${g.reason}`).join("; ") || "(aucun)"}
Priorités : ${context.priorities.map((p) => `${p.name} — ${p.reason}`).join("; ") || "(aucune)"}
${context.sourceDocText ? `\nDocument(s) projet fourni(s) (contexte supplémentaire) :\n${context.sourceDocText}` : ""}`;
}

export function parseDeliverableOutput(kind: DeliverableKind, rawText: string): { title: string; content: DeliverableContent } {
  const raw = extractJson(rawText);
  const parsed = deliverableOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DeliverParseError(`Le résultat du livrable ne respecte pas le format attendu : ${parsed.error.message}`);
  }
  const contentSchema = CONTENT_SCHEMAS[kind];
  const contentParsed = contentSchema.safeParse(parsed.data.content);
  if (!contentParsed.success) {
    throw new DeliverParseError(
      `Le contenu du livrable "${DELIVERABLE_LABELS[kind]}" ne respecte pas le format attendu : ${contentParsed.error.message}`
    );
  }
  return { title: parsed.data.title, content: contentParsed.data as DeliverableContent };
}

// ---------------------------------------------------------------------
// Feedback & Recalibration
// ---------------------------------------------------------------------

const recalibrationSchema = z.object({
  updatedPriorities: z
    .array(z.object({ name: z.string().min(1), reason: z.string().min(1), weight: z.number().min(0).max(100) }))
    .min(1)
    .max(6),
  recommendation: z.string().min(1),
  roadmapAdjustment: z
    .object({
      proposed: z.boolean(),
      note: z.string().min(1),
      phaseChanges: z
        .array(
          z.object({
            phaseName: z.string().min(1),
            newEndDate: z.string().nullable().optional(),
            newActions: z.array(z.string().min(1)).nullable().optional(),
          })
        )
        .min(0)
        .max(6),
    })
    .nullable(),
});

export function buildRecalibrationSystemPrompt(): string {
  return `You are the recalibration engine for "4 Tomorrow / Deliver". The user reports real execution progress, delays, or risks encountered on an already-running project (context and current priorities given below). Analyze it and propose an updated plan.

Produce:
- updatedPriorities: the priorities list, re-weighted (0-100, should sum roughly to 100) to reflect what the feedback reveals — carry forward priorities still valid, adjust weights, add a new one only if the feedback clearly reveals something not covered yet.
- recommendation: one concrete, specific paragraph on what to do next given this feedback — never generic reassurance.
- roadmapAdjustment: only if the feedback genuinely implies the roadmap phases need to change (a real delay, a phase now irrelevant, a new dependency) — set proposed:true with a clear note explaining why, and phaseChanges naming which phase(s) and what changes (a new end date and/or revised actions). If the feedback doesn't warrant a roadmap change, set proposed:false with a short note saying so, and phaseChanges: [].

CORE RULE — NEVER GENERIC: ground every point in what the user actually reported, never a generic "stay the course" or "monitor the situation".

This is a PROPOSAL ONLY — nothing here is applied automatically; the user reviews and confirms before anything changes.

Respond in French except JSON keys, which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema:
{
  "updatedPriorities": [{ "name": string, "reason": string, "weight": number }],
  "recommendation": string,
  "roadmapAdjustment": { "proposed": boolean, "note": string, "phaseChanges": [{ "phaseName": string, "newEndDate": string|null, "newActions": [string]|null }] }
}`;
}

export function buildRecalibrationUserPrompt(context: DeliverGenerationContext & { feedbackText: string; phaseNames: string[] }): string {
  return `${buildDeliverableUserPrompt(context)}

Phases actuelles de la roadmap : ${context.phaseNames.join(", ") || "(aucune)"}

Feedback terrain soumis par l'utilisateur :
${context.feedbackText}`;
}

export function parseRecalibrationOutput(rawText: string): RecalibrationSummary {
  const raw = extractJson(rawText);
  const parsed = recalibrationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DeliverParseError(`Le résultat de la recalibration ne respecte pas le format attendu : ${parsed.error.message}`);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------
// Execution Gantt — "Regenerate" refreshes only the not-yet-started
// phases, never the whole roadmap from scratch (that's Decide's job).
// A separate schema/prompt from Decide's own roadmap generation (small
// duplication, same convention as extractJson above) rather than reaching
// into decide.ts's private phase schema, which isn't exported.
// ---------------------------------------------------------------------

const adjustPhaseSchema = z.object({
  name: z.string().min(1),
  durationWeeks: z.number().min(1).max(52),
  deliverables: z.array(z.string().min(1)).min(1).max(6),
  actions: z.array(z.string().min(1)).min(1).max(6),
  kpis: z.array(z.string().min(1)).min(1).max(6),
});
const adjustRoadmapSchema = z.object({ phases: z.array(adjustPhaseSchema).min(1).max(6) });
export type AdjustRoadmapOutput = z.infer<typeof adjustRoadmapSchema>;

export function buildRoadmapAdjustSystemPrompt(): string {
  return `You are the execution roadmap engine for "4 Tomorrow / Deliver". A roadmap for the already-chosen trajectory exists and some of its early phases are already done or in progress (listed below — do not repeat or contradict them). Your job is to REFRESH ONLY THE REMAINING phases, taking into account what has already been executed and updated priority sliders (0-100 each: cost control, CO2/sustainability-or-equivalent, risk mitigation, speed-to-impact).

Keep roughly the same remaining phase names and sequence given below unless the context genuinely calls for a different one — this is a refinement of what's left, not a from-scratch redesign. Each phase needs: name, durationWeeks, deliverables, actions, kpis — same standard as any roadmap: specific to this exact project, never generic.

How sliders influence the plan: a higher "speed" priority should compress remaining timelines and front-load quick wins; a higher "risk mitigation" priority should add or lengthen validation/testing; a higher "cost control" priority should favor phased, lower-commitment steps; a higher "CO2/sustainability" priority should foreground phases that de-risk or prove that angle early.

HARD ARRAY LIMITS — never exceed these, the response is rejected otherwise: deliverables ≤4, actions ≤4, kpis ≤3, per phase.

CORE RULE — NEVER GENERIC: same standard as the rest of 4 Tomorrow — every deliverable/action/kpi must contain something specific to this project.

Respond in French except JSON keys, which stay in English.

${RESULT_INSTRUCTION}

Schema:
{ "phases": [{ "name": string, "durationWeeks": number, "deliverables": [string], "actions": [string], "kpis": [string] }] }`;
}

export function buildRoadmapAdjustUserPrompt(
  context: DeliverGenerationContext & {
    completedPhases: { name: string; endDate: string }[];
    remainingPhaseNames: string[];
    priorityCost: number;
    priorityCo2: number;
    priorityRisk: number;
    prioritySpeed: number;
  }
): string {
  return `${buildDeliverableUserPrompt(context)}

Phases déjà exécutées (ne pas répéter, ne pas modifier) : ${
    context.completedPhases.map((p) => `${p.name} (terminée le ${p.endDate})`).join("; ") || "(aucune)"
  }
Phases restantes à réajuster, dans l'ordre : ${context.remainingPhaseNames.join(", ")}

Priorités ajustées par le client (0-100) :
- Maîtrise des coûts : ${context.priorityCost}
- CO2 / durabilité (ou équivalent) : ${context.priorityCo2}
- Réduction des risques : ${context.priorityRisk}
- Rapidité de mise en œuvre : ${context.prioritySpeed}`;
}

export function parseRoadmapAdjustOutput(rawText: string): AdjustRoadmapOutput {
  const raw = extractJson(rawText);
  const parsed = adjustRoadmapSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DeliverParseError(`Le résultat de l'ajustement ne respecte pas le format attendu : ${parsed.error.message}`);
  }
  return parsed.data;
}
