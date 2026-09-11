import { z } from "zod";
import type { EcosystemMember } from "@/types/database";

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

export const DOMAINS = ["manufacturing", "rd", "gtm", "strategy", "digitalization"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  manufacturing: "Manufacturing / Production",
  rd: "R&D",
  gtm: "Commercialisation / Go-to-market",
  strategy: "Stratégie",
  digitalization: "Digitalisation",
};

const RESULT_START = "<RESULT_JSON>";
const RESULT_END = "</RESULT_JSON>";

function extractJson(rawText: string): unknown {
  const start = rawText.indexOf(RESULT_START);
  const end = rawText.indexOf(RESULT_END);
  if (start === -1 || end === -1 || end < start) {
    throw new DecideParseError("Le modèle n'a pas renvoyé de résultat structuré exploitable.");
  }
  const jsonText = rawText.slice(start + RESULT_START.length, end).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new DecideParseError("Le résultat renvoyé par le modèle n'est pas un JSON valide.");
  }
}

export class DecideParseError extends Error {}

const RESULT_INSTRUCTION = `Output your final answer as JSON matching the exact shape given, and nothing else after it, wrapped exactly like this:
${RESULT_START}
{ ... }
${RESULT_END}
The block must be the last thing in your response, with valid JSON (no trailing commas, no comments) inside it.`;

// ---------------------------------------------------------------------------
// Stage 1 — Diagnostic: domain detection, maturity, gaps/priorities/risks,
// and module recommendations. No web_search — pure reasoning over the
// intake, kept fast and reliable.
// ---------------------------------------------------------------------------

export interface DiagnosticInput {
  organization: string;
  industry: string;
  challenges: string;
  objectives: string;
  constraints: string;
  regulations: string;
  uploadedDocText: string;
}

const relevanceEnum = z.enum(["relevant", "possible", "not_relevant"]);

const diagnosticSchema = z.object({
  domains: z.array(z.enum(DOMAINS)).min(1),
  maturityReading: z.string().min(1),
  gaps: z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
  priorities: z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
  risks: z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).min(1).max(3),
  startingRecommendation: z.string().min(1),
  moduleRecommendations: z.object({
    connect: z.object({ relevance: relevanceEnum, reason: z.string().min(1) }),
    learn: z.object({ relevance: relevanceEnum, reason: z.string().min(1) }),
    deliver: z.object({ relevance: relevanceEnum, reason: z.string().min(1) }),
  }),
});

export type DiagnosticOutput = z.infer<typeof diagnosticSchema>;

export function buildDiagnosticSystemPrompt(): string {
  return `You are the diagnostic engine for "4 Tomorrow / Decide", a strategic transformation advisory platform used by industrial and business decision-makers.

STEP 0 — DOMAIN DETECTION (internal reasoning, drives everything below, never shown to the user as a menu):
Classify the challenge into one or more of these domains based on signals in the intake:
- manufacturing: production lines, capacity, yield, physical supply chain
- rd: innovation, prototypes, research, patents, emerging technology
- gtm: launch, market, customers, distribution, sales
- strategy: positioning, trade-offs, resource allocation, executive committee decisions
- digitalization: systems, data, legacy, IT integration
A challenge can span multiple domains (e.g. digitalizing a production line is both manufacturing and digitalization) — combine grids rather than forcing a single frame.

CORE RULE — NEVER GENERIC: every sentence you write must contain something that would only be true for THIS specific challenge — a number, a name, a constraint the user actually stated. Ban phrases that could apply to any company in any sector ("optimize processes", "strengthen market position", "digitalize the company"). If you lack information to be specific on a point, say so explicitly ("insufficient information to quantify this") rather than filling in a plausible generality.

Produce:
1. domains: the detected domain(s) from the list above.
2. maturityReading: one paragraph reading of the organization's current maturity on this challenge, grounded in what they actually said.
3. gaps: up to 3 concrete gaps (missing capability, resource, or knowledge) — each tied to something specific in the intake.
4. priorities: up to 3 priorities — what matters most to address first, and why, specific to this challenge.
5. risks: up to 3 cross-cutting risks (not yet tied to any specific strategic option).
6. startingRecommendation: one paragraph — where to start, concretely.
7. moduleRecommendations: for each of "connect", "learn", "deliver", a relevance ("relevant" | "possible" | "not_relevant") and a one-sentence reason grounded in the actual gaps found:
   - connect is "relevant" when a gap implies needing something external (a technology, partner, supplier, or skill not held internally).
   - learn is "relevant" when a gap is capability/human in nature (missing internal skills, a team that needs training) rather than purely technical or external.
   - deliver stays "possible" at this stage (no strategic option has been chosen yet to execute) — never "relevant" here, and never "not_relevant" either, since execution is always eventually needed once a path is chosen.

Respond in French, matching the user's language, except JSON keys which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema:
{
  "domains": ["manufacturing" | "rd" | "gtm" | "strategy" | "digitalization", ...],
  "maturityReading": string,
  "gaps": [{ "name": string, "reason": string }],
  "priorities": [{ "name": string, "reason": string }],
  "risks": [{ "name": string, "reason": string }],
  "startingRecommendation": string,
  "moduleRecommendations": {
    "connect": { "relevance": "relevant"|"possible"|"not_relevant", "reason": string },
    "learn": { "relevance": "relevant"|"possible"|"not_relevant", "reason": string },
    "deliver": { "relevance": "relevant"|"possible"|"not_relevant", "reason": string }
  }
}`;
}

export function buildDiagnosticUserPrompt(input: DiagnosticInput): string {
  return `Organisation : ${input.organization || "(non précisé)"}
Industrie : ${input.industry || "(non précisé)"}

Défis (texte libre de l'utilisateur) :
${input.challenges || "(non fourni)"}

Objectifs :
${input.objectives || "(non fourni)"}

Contraintes :
${input.constraints || "(non fourni)"}

Régulations externes applicables connues du client :
${input.regulations || "(non précisé)"}

${input.uploadedDocText ? `Contenu extrait d'un document fourni par l'utilisateur (même poids que les champs texte ci-dessus) :\n${input.uploadedDocText}` : ""}`;
}

export function parseDiagnosticOutput(rawText: string): DiagnosticOutput {
  const raw = extractJson(rawText);
  const parsed = diagnosticSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DecideParseError(
      `Le résultat du diagnostic ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Stage 2 — Scenarios: 3 adaptive strategic scenarios with stack, suppliers
// (web_search + registry, same mechanism as CONNECT), regulations,
// executive briefing, scenario-specific risks/opportunities, radar scores.
// ---------------------------------------------------------------------------

export interface ScenarioGenerationInput {
  domains: Domain[];
  organization: string;
  industry: string;
  challenges: string;
  objectives: string;
  constraints: string;
  gaps: { name: string; reason: string }[];
  priorities: { name: string; reason: string }[];
}

const techStackItemSchema = z.object({
  name: z.string().min(1),
  maturity: z.string().min(1),
  maturityScale: z.string().min(1),
  detail: z.string().min(1),
  benefit: z.string().min(1),
});

const scenarioSupplierSchema = z.object({
  category: z.enum(["technology", "startup", "expert", "partner", "funding"]),
  name: z.string().min(1),
  reason: z.string().min(1),
  website: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  source: z.enum(["registry", "web_search"]),
  ecosystemMemberId: z.string().nullable().optional(),
});

const regulationSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sourceUrl: z.string().nullable().optional(),
});

const scenarioSchema = z.object({
  name: z.string().min(1),
  stance: z.string().min(1),
  description: z.string().min(1),
  indicators: z.record(z.string(), z.union([z.string(), z.number()])),
  radarScores: z.record(z.string(), z.number()),
  techStack: z.array(techStackItemSchema).min(1).max(4),
  // Max kept a couple items above what the prompt asks for (4/4/3/3) — the
  // model overshot the exact caps in production even once told the target
  // count in prose, and a hard zod failure discards an otherwise-good
  // scenario. This is slack for that overshoot, not a raised target.
  suppliers: z.array(scenarioSupplierSchema).min(0).max(6),
  regulations: z.array(regulationSchema).min(0).max(6),
  executiveBriefing: z.string().min(1),
  risksSpecific: z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).min(1).max(5),
  opportunitiesSpecific: z
    .array(z.object({ name: z.string().min(1), reason: z.string().min(1) }))
    .min(1)
    .max(5),
});

export type ScenarioOutput = z.infer<typeof scenarioSchema>;

// Generated one scenario per call, in parallel (see route.ts) — a single
// call asked to produce all 3 full scenarios (stack, suppliers, regulations,
// briefing, risks/opportunities each) with web search ran past the 170s
// Anthropic timeout / 180s function budget in production ("Load failed" on
// the client — the platform dropped the connection before our own timeout
// handler could respond). Three parallel single-scenario calls each carry
// roughly CONNECT's original single-category workload, which stayed inside
// budget, and total wall-clock time is bounded by the slowest one, not the
// sum of all three.
export type ScenarioSlot = 1 | 2 | 3;

const SLOT_HINTS: Record<ScenarioSlot, string> = {
  1: "You are generating SCENARIO 1 of 3: the more CONSERVATIVE / lower-risk / faster-to-first-value option along whatever axis actually fits this subject (e.g. progressive migration, partnership over build, phased rollout, quick-win-first).",
  2: "You are generating SCENARIO 2 of 3: the BALANCED option — a middle path between a conservative and an ambitious framing, whatever that means for this specific subject.",
  3: "You are generating SCENARIO 3 of 3: the more AMBITIOUS / higher-commitment / higher-upside option along whatever axis fits this subject (e.g. full replacement, build over partner, leadership positioning) — still realistic and grounded, never reckless just to be different.",
};

export function buildScenarioSystemPrompt(registry: EcosystemMember[], slot: ScenarioSlot): string {
  const registryBlock =
    registry.length > 0
      ? registry
          .map(
            (m) =>
              `- id=${m.id} | name="${m.name}" | type="${m.type}"${m.website ? ` | website=${m.website}` : ""}${
                m.contact ? ` | contact=${m.contact}` : ""
              }`
          )
          .join("\n")
      : "(empty — rely entirely on web search)";

  return `You are the scenario engine for "4 Tomorrow / Decide". You generate ONE distinct strategic scenario (trajectory) for a transformation challenge already diagnosed (domains, gaps, priorities given below). Two other calls, run in parallel, are generating the other two scenarios independently — your job is only to make sure THIS one is coherent and clearly positioned at its assigned slot, not to reference the others.

${SLOT_HINTS[slot]}

KNOWN ECOSYSTEM DIRECTORY (community-contributed, same "living directory" mechanism used by the CONNECT module — prefer these when relevant and mark source "registry" with their id):
${registryBlock}

You have a web_search tool (max 2 uses). Use it efficiently — batch what you need, then finalize. You are working under a hard time budget; a complete, on-time answer beats an exhaustive but late one.

PRINCIPE DIRECTEUR — everything adapts to the actual subject, nothing is templated:
- Choose scenario postures that fit the detected domain(s) — e.g. for digitalization: deployment speed vs integration depth vs legacy resilience; for go-to-market: fast penetration vs brand-building vs distribution partnerships; for product development: build vs partner vs acquire; for technical modernization: full replacement vs progressive migration vs hybrid; for heavy industrial transformation: operational efficiency vs technology balance vs environmental leadership. Pick whichever framing actually fits this challenge — never force a "cost vs CO2 vs physical tech" frame on a non-industrial subject.
- indicators: choose the KPIs that make sense for this type of challenge (e.g. cost delta, CO2 reduction, ROI in years for an industrial/physical transformation; cost delta, time-to-market, ROI in months, acquisition/retention impact for a digital, product, or commercial one). Never force the same three metrics onto every subject.
- techStack: up to 4 elements — physical technologies, software components, distribution channels, or skills to acquire, whichever fits the scenario. maturityScale must itself be adapted: "TRL 1-9" only for a physical or mature technology; "validated / pilot / hypothesis" for a commercial or organizational approach; another scale if that fits better. Always state in "detail" whether the maturity level comes from a verified source or is an estimate — never imply a false precision.
- suppliers: the type of actor searched for (technical supplier, distributor, marketing partner, integrator, investor...) must be determined by the nature of THIS scenario, not fixed in advance. Every supplier must be a real, specific, verifiable organization or named person — NEVER something generic. Only include website/contactEmail when reasonably confident it is real; omit rather than invent.
- regulations: search for and list only regulations/certifications/standards actually relevant to this specific subject and found with a source — industrial/safety standards for a physical subject, sectoral regulation (GDPR, financial compliance, etc.) for a digital or product subject, market standards for a commercialization subject. Never invent a reference; if none found, return an empty array.
- radarScores: 0-10 per axis, in coherence with the indicators you just stated (never a score disconnected from the displayed numbers). Always include "cost", "risk", "roi", "feasibility" as axes, plus ONE more axis you choose to fit the subject (e.g. "co2" for an industrial/environmental subject, "speed" or "scalability" for a digital/commercial one).
- risksSpecific / opportunitiesSpecific: distinct from the transverse risks already identified in the diagnostic — specific to what makes THIS scenario's approach risky or promising.

HARD ARRAY LIMITS — never exceed these, the response is rejected otherwise: techStack ≤4 items, suppliers ≤4 items, regulations ≤4 items, risksSpecific ≤3 items, opportunitiesSpecific ≤3 items. Pick the most important entries rather than listing everything you found.

CORE RULE — NEVER GENERIC, same as the diagnostic: every sentence must contain something only true for this exact challenge. If information is insufficient to be precise on a point, say so rather than filling in a plausible generality.

Respond in French except JSON keys, which stay in English exactly as specified.

${RESULT_INSTRUCTION}

Schema (a single scenario object, not an array):
{
  "name": string,
  "stance": string,
  "description": string,
  "indicators": { [key: string]: string | number },
  "radarScores": { "cost": number, "risk": number, "roi": number, "feasibility": number, [fifthAxis: string]: number },
  "techStack": [{ "name": string, "maturity": string, "maturityScale": string, "detail": string, "benefit": string }],
  "suppliers": [{ "category": "technology"|"startup"|"expert"|"partner"|"funding", "name": string, "reason": string, "website": string|null, "contactEmail": string|null, "source": "registry"|"web_search", "ecosystemMemberId": string|null }],
  "regulations": [{ "name": string, "description": string, "sourceUrl": string|null }],
  "executiveBriefing": string,
  "risksSpecific": [{ "name": string, "reason": string }],
  "opportunitiesSpecific": [{ "name": string, "reason": string }]
}`;
}

export function buildScenariosUserPrompt(input: ScenarioGenerationInput): string {
  return `Domaines détectés : ${input.domains.map((d) => DOMAIN_LABELS[d]).join(", ")}
Organisation : ${input.organization || "(non précisé)"}
Industrie : ${input.industry || "(non précisé)"}
Défis : ${input.challenges || "(non fourni)"}
Objectifs : ${input.objectives || "(non fourni)"}
Contraintes : ${input.constraints || "(non fourni)"}

Gaps identifiés :
${input.gaps.map((g) => `- ${g.name} : ${g.reason}`).join("\n")}

Priorités identifiées :
${input.priorities.map((p) => `- ${p.name} : ${p.reason}`).join("\n")}`;
}

export function parseScenarioOutput(rawText: string): ScenarioOutput {
  const raw = extractJson(rawText);
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DecideParseError(
      `Le résultat d'un scénario ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Stage 3 — Roadmap: adaptive Gantt phases for the chosen scenario,
// re-generatable from priority sliders. No web_search — fast reasoning call.
// ---------------------------------------------------------------------------

export interface RoadmapGenerationInput {
  domains: Domain[];
  scenarioName: string;
  scenarioStance: string;
  scenarioDescription: string;
  indicators: Record<string, string | number>;
  priorityCost: number;
  priorityCo2OrEquivalent: number;
  priorityRisk: number;
  prioritySpeed: number;
}

const roadmapPhaseSchema = z.object({
  name: z.string().min(1),
  durationWeeks: z.number().min(1).max(52),
  deliverables: z.array(z.string().min(1)).min(1).max(6),
  actions: z.array(z.string().min(1)).min(1).max(6),
  kpis: z.array(z.string().min(1)).min(1).max(4),
});

const roadmapOutputSchema = z.object({
  phases: z.array(roadmapPhaseSchema).min(3).max(5),
});

export type RoadmapOutput = z.infer<typeof roadmapOutputSchema>;

export function buildRoadmapSystemPrompt(): string {
  return `You are the roadmap engine for "4 Tomorrow / Decide". Given one already-chosen strategic scenario and 4 client-adjusted priority sliders (0-100 each: cost control, CO2/sustainability-or-equivalent, risk mitigation, speed-to-impact), generate an execution roadmap of 3 to 5 phases.

PRINCIPE DIRECTEUR: the number of phases, their nature, and their exit KPIs must reflect the REAL type of project, never a fixed template. Examples (choose whichever fits, or another framing entirely if more appropriate):
- Digital project: "Cadrage", "Développement", "Déploiement", "Adoption"
- Industrial/physical project: "Validation système", "Certification", "Industrialisation"
- Commercial launch: phases fitting a go-to-market sequence
Never reuse an industrial phase template for a digital or commercial project, or vice versa.

How sliders influence the roadmap: a higher "speed" priority should compress timelines and front-load quick wins; a higher "risk mitigation" priority should add or lengthen validation/testing phases; a higher "cost control" priority should favor phased, lower-commitment steps over big upfront investment; a higher "CO2/sustainability" priority should foreground phases that de-risk or prove the sustainability angle early. Let the sliders actually reorder or resize phases, not just decorate them.

Each phase needs: name, durationWeeks (a whole number of weeks for THIS phase, sequential — phase 2 starts the week phase 1 ends), deliverables (concrete outputs), actions (concrete steps), kpis (phase-exit indicators, specific to this phase and this project, never generic like "on time and on budget").

CORE RULE — NEVER GENERIC: same standard as the rest of Decide — every deliverable/action/kpi must contain something specific to this scenario.

Respond in French except JSON keys, which stay in English.

${RESULT_INSTRUCTION}

Schema:
{ "phases": [{ "name": string, "durationWeeks": number, "deliverables": [string], "actions": [string], "kpis": [string] }] }
(3 to 5 entries, in sequential order)`;
}

export function buildRoadmapUserPrompt(input: RoadmapGenerationInput): string {
  return `Domaines détectés : ${input.domains.map((d) => DOMAIN_LABELS[d]).join(", ")}
Scénario choisi : ${input.scenarioName} (posture : ${input.scenarioStance})
Description : ${input.scenarioDescription}
Indicateurs : ${JSON.stringify(input.indicators)}

Priorités ajustées par le client (0-100) :
- Maîtrise des coûts : ${input.priorityCost}
- CO2 / durabilité (ou équivalent pour ce type de projet) : ${input.priorityCo2OrEquivalent}
- Réduction des risques : ${input.priorityRisk}
- Rapidité de mise en œuvre : ${input.prioritySpeed}`;
}

export function parseRoadmapOutput(rawText: string): RoadmapOutput {
  const raw = extractJson(rawText);
  const parsed = roadmapOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DecideParseError(
      `Le résultat de la roadmap ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }
  return parsed.data;
}
