import { z } from "zod";
import { DOMAINS, DOMAIN_LABELS, type Domain } from "@/lib/decide";
import { EXECUTIVE_NARRATIVE_RULES } from "@/lib/executive-narrative";
import { computeFlow, validateFlowInputs, type FlowStepInput } from "@/lib/decide-flow-calc";
import { computeObservedAnnual, type BenefitObservationInput } from "@/lib/deliver-benefits-calc";
import {
  DELIVERABLE_KINDS,
  type DeliverableKind,
  type DeliverableContent,
  type RecalibrationSummary,
  type Language,
} from "@/types/database";

function languageInstruction(language: Language): string {
  const languageName = language === "en" ? "English" : "French";
  return `Respond in ${languageName}, except JSON keys which stay in English exactly as specified. Write every human-readable value in ${languageName} even when the user's own input, documents or sources are written in another language; keep proper nouns (company, product, place names) as they are.`;
}

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

// Per-kind guided questionnaire shown before generation (Deliver's one-click
// blind generation replaced by "a few real-world inputs first" — the AI
// still never calculates anything, these are narrative grounding facts it's
// told to prefer over guessing). Every field is optional and the fast
// "Boost All" path still works with none of them filled — this only makes
// output sharper when the client actually answers, never a hard gate.
export type DeliverableInputFieldDef = {
  key: string;
  // Invariant, English — goes into the AI prompt regardless of UI language.
  promptLabel: string;
  label: { fr: string; en: string };
  placeholder: { fr: string; en: string };
  multiline?: boolean;
  // "date" renders a native date picker and stores AAAA-MM-JJ, so the value
  // can feed deterministic date math (src/lib/deliver-gantt-calc.ts).
  inputType?: "date";
};

const INPUT_FIELDS: Record<DeliverableKind, DeliverableInputFieldDef[]> = {
  // Feuille de route — the guided path of the Gantt: what the client already
  // knows (dates, milestones, must-do actions, expected outputs). Shared by
  // Décider's roadmap generation (src/components/decide/roadmap-view.tsx)
  // and Livrer's roadmap deliverable. Dates are never left to the AI: the
  // start/target dates drive the phase dates server-side.
  roadmap: [
    {
      key: "startDate",
      promptLabel: "Actual execution start date (YYYY-MM-DD)",
      label: { fr: "Date de démarrage réelle", en: "Actual start date" },
      placeholder: { fr: "AAAA-MM-JJ", en: "YYYY-MM-DD" },
      inputType: "date",
    },
    {
      key: "targetEndDate",
      promptLabel: "Target end date for the whole roadmap (YYYY-MM-DD) — phases must fit before it",
      label: { fr: "Date cible de fin", en: "Target end date" },
      placeholder: { fr: "AAAA-MM-JJ", en: "YYYY-MM-DD" },
      inputType: "date",
    },
    {
      key: "milestones",
      promptLabel: "Milestones already committed (name — date when known); each must appear as the exit of a phase",
      label: { fr: "Jalons déjà fixés (un par ligne : nom — date si connue)", en: "Committed milestones (one per line: name — date if known)" },
      placeholder: {
        fr: "Ex :\nGo/No-go pilote — 2026-03-15\nMise en service ligne 2 — 2026-06-01\nAudit client",
        en: "E.g.:\nPilot go/no-go — 2026-03-15\nLine 2 commissioning — 2026-06-01\nCustomer audit",
      },
      multiline: true,
    },
    {
      key: "priorityActions",
      promptLabel: "Priority actions already known — they must be placed in the right phase, not replaced",
      label: { fr: "Actions prioritaires déjà connues", en: "Priority actions already known" },
      placeholder: {
        fr: "Ex : signer l'intégrateur MES, former les chefs d'équipe, auditer les stocks de la ligne 2",
        en: "E.g.: sign the MES integrator, train team leads, audit line 2 inventory",
      },
      multiline: true,
    },
    {
      key: "expectedDeliverables",
      promptLabel: "Deliverables expected by management — each must be produced by one phase",
      label: { fr: "Livrables attendus", en: "Expected deliverables" },
      placeholder: {
        fr: "Ex : cahier des charges MES, rapport de pilote, procédure qualité mise à jour",
        en: "E.g.: MES specification, pilot report, updated quality procedure",
      },
      multiline: true,
    },
    {
      key: "constraints",
      promptLabel: "Known scheduling constraints, blackout periods and resources actually available",
      label: { fr: "Contraintes de planning et ressources disponibles", en: "Scheduling constraints and available resources" },
      placeholder: {
        fr: "Ex : arrêt usine en août, 2 chefs de projet, budget bloqué jusqu'au T2",
        en: "E.g.: plant shutdown in August, 2 project leads, budget locked until Q2",
      },
      multiline: true,
    },
  ],
  action_plan: [
    {
      key: "immediateCapacity",
      promptLabel: "Who can act immediately, right now",
      label: { fr: "Qui peut agir dès maintenant", en: "Who can act immediately" },
      placeholder: { fr: "Ex : l'équipe qualité, dispo à 50%", en: "E.g.: the quality team, 50% available" },
    },
    {
      key: "blockers",
      promptLabel: "Blockers already known today",
      label: { fr: "Blocages déjà identifiés", en: "Blockers already known" },
      placeholder: { fr: "Ex : validation juridique en attente", en: "E.g.: legal sign-off pending" },
      multiline: true,
    },
    {
      key: "horizon",
      promptLabel: "Time horizon this action plan must cover",
      label: { fr: "Horizon de temps visé", en: "Time horizon" },
      placeholder: { fr: "Ex : 30 jours, 90 jours", en: "E.g.: 30 days, 90 days" },
    },
  ],
  // Tableau de bord KPI — the per-indicator questions (baseline + owner for
  // each indicator already identified in Décider) are built dynamically by
  // kpiIndicatorFields below; these are the dashboard-wide ones. When the
  // project has no indicator yet, "currentBaseline" stays as the fallback.
  kpi_dashboard: [
    {
      key: "currentBaseline",
      promptLabel: "Real current measured values for the indicators — use these instead of guessing",
      label: { fr: "Valeurs de référence actuelles des indicateurs suivis", en: "Current reference values of tracked indicators" },
      placeholder: {
        fr: "Ex : taux de service 92 % (oct.), délai moyen 6 j, rebut 3,1 %",
        en: "E.g.: service rate 92% (Oct.), average lead time 6d, scrap 3.1%",
      },
      multiline: true,
    },
    {
      key: "reportingFrequency",
      promptLabel: "Real steering rhythm: which body reviews these KPIs, and how often",
      label: { fr: "Fréquence de pilotage réelle (quelle instance, quel rythme)", en: "Real steering rhythm (which body, how often)" },
      placeholder: {
        fr: "Ex : point hebdo atelier le lundi, comité de direction mensuel",
        en: "E.g.: weekly shop-floor review on Mondays, monthly executive committee",
      },
    },
    {
      key: "dataSource",
      promptLabel: "Where each figure actually comes from (system, file, manual count)",
      label: { fr: "Source réelle des chiffres", en: "Actual source of the figures" },
      placeholder: {
        fr: "Ex : ERP pour les délais, relevé manuel pour le rebut",
        en: "E.g.: ERP for lead times, manual count for scrap",
      },
    },
    {
      key: "alertThresholds",
      promptLabel: "Deviation thresholds that must trigger an action",
      label: { fr: "Seuils d'alerte qui déclenchent une action", en: "Alert thresholds that trigger an action" },
      placeholder: {
        fr: "Ex : taux de service < 90 % deux semaines de suite",
        en: "E.g.: service rate < 90% two weeks in a row",
      },
    },
  ],
  risk_map: [
    {
      key: "knownRisks",
      promptLabel: "Risks the team has already identified or experienced",
      label: { fr: "Risques déjà identifiés en interne", en: "Risks already identified internally" },
      placeholder: {
        fr: "Ex : turnover sur l'équipe technique, dépendance à un seul fournisseur",
        en: "E.g.: turnover on the technical team, single-supplier dependency",
      },
      multiline: true,
    },
    {
      key: "riskAppetite",
      promptLabel: "Organization's actual risk tolerance for this project",
      label: { fr: "Appétence au risque de l'organisation", en: "Organization's risk appetite" },
      placeholder: { fr: "Ex : faible — zéro tolérance sur la sécurité", en: "E.g.: low — zero tolerance on safety" },
    },
    {
      key: "pastIncidents",
      promptLabel: "Past incidents or failed projects worth learning from",
      label: { fr: "Incidents ou échecs passés à prendre en compte", en: "Past incidents to account for" },
      placeholder: {
        fr: "Ex : un déploiement similaire a échoué en 2023 faute de formation",
        en: "E.g.: a similar rollout failed in 2023 due to lack of training",
      },
      multiline: true,
    },
  ],
  executive_report: [
    {
      key: "audience",
      promptLabel: "The actual audience of this report",
      label: { fr: "Destinataire réel de ce rapport", en: "Actual audience of this report" },
      placeholder: { fr: "Ex : comité de direction, conseil d'administration", en: "E.g.: executive committee, board of directors" },
    },
    {
      key: "decisionNeeded",
      promptLabel: "The specific decision this report must support",
      label: { fr: "Décision attendue à l'issue du rapport", en: "Decision this report must support" },
      placeholder: { fr: "Ex : valider le budget d'exécution", en: "E.g.: approve the execution budget" },
    },
    {
      key: "deadline",
      promptLabel: "Deadline this report is tied to",
      label: { fr: "Échéance liée à ce rapport", en: "Deadline tied to this report" },
      placeholder: { fr: "Ex : comité du 20 décembre", en: "E.g.: Dec 20 steering committee" },
    },
  ],
  toolkit: [
    {
      key: "existingTools",
      promptLabel: "Tools the organization already uses today — avoid redundant recommendations",
      label: { fr: "Outils déjà utilisés aujourd'hui", en: "Tools already in use today" },
      placeholder: { fr: "Ex : Excel, ERP SAP, Trello", en: "E.g.: Excel, SAP ERP, Trello" },
      multiline: true,
    },
    {
      key: "budget",
      promptLabel: "Realistic budget available for new tools",
      label: { fr: "Budget réaliste pour de nouveaux outils", en: "Realistic budget for new tools" },
      placeholder: { fr: "Ex : limité, privilégier le gratuit/open-source", en: "E.g.: limited, prefer free/open-source" },
    },
    {
      key: "techConstraints",
      promptLabel: "Technical constraints any new tool must respect",
      label: { fr: "Contraintes techniques à respecter", en: "Technical constraints to respect" },
      placeholder: {
        fr: "Ex : doit s'intégrer à l'ERP existant, données hébergées en France",
        en: "E.g.: must integrate with the existing ERP, data hosted in France",
      },
      multiline: true,
    },
  ],
};

// Per-indicator questions for the KPI dashboard: one baseline and one owner
// question for each indicator the chosen trajectory already carries — the
// founder's ask was "valeur de référence PAR indicateur", not one generic
// box. Capped so the form stays answerable.
export const MAX_KPI_INDICATOR_QUESTIONS = 6;

function kpiIndicatorFields(indicatorNames: string[]): DeliverableInputFieldDef[] {
  return indicatorNames.slice(0, MAX_KPI_INDICATOR_QUESTIONS).flatMap((name) => [
    {
      key: `baseline:${name}`,
      promptLabel: `Current measured baseline of indicator "${name}" (use as its "current" value, verbatim)`,
      label: { fr: `${name} — valeur actuelle mesurée`, en: `${name} — current measured value` },
      placeholder: { fr: "Ex : 92 % mesuré en octobre", en: "E.g.: 92% measured in October" },
    },
    {
      key: `owner:${name}`,
      promptLabel: `Person or role accountable for tracking indicator "${name}"`,
      label: { fr: `${name} — responsable du suivi`, en: `${name} — accountable for tracking` },
      placeholder: { fr: "Ex : responsable qualité usine", en: "E.g.: plant quality manager" },
    },
  ]);
}

export type DeliverableFieldContext = { indicatorNames?: string[] };

function fieldDefs(kind: DeliverableKind, ctx: DeliverableFieldContext = {}): DeliverableInputFieldDef[] {
  const names = (ctx.indicatorNames ?? []).map((n) => n.trim()).filter(Boolean);
  if (kind === "kpi_dashboard" && names.length > 0) {
    return [...kpiIndicatorFields(names), ...INPUT_FIELDS.kpi_dashboard.filter((f) => f.key !== "currentBaseline")];
  }
  return INPUT_FIELDS[kind];
}

export function getDeliverableInputFields(
  kind: DeliverableKind,
  language: Language,
  ctx: DeliverableFieldContext = {}
): { key: string; label: string; placeholder: string; multiline?: boolean; inputType?: "date" }[] {
  return fieldDefs(kind, ctx).map((f) => ({
    key: f.key,
    label: f.label[language],
    placeholder: f.placeholder[language],
    multiline: f.multiline,
    inputType: f.inputType,
  }));
}

// Only known keys for this kind are read — anything else the client sends
// is ignored rather than rejected, same permissive-but-bounded approach as
// the rest of Deliver's free-text fields. Each value capped defensively.
export function buildInputsBlock(
  kind: DeliverableKind,
  inputs: Record<string, string>,
  ctx: DeliverableFieldContext = {}
): string {
  const filled = fieldDefs(kind, ctx)
    .map((f) => ({ label: f.promptLabel, value: (inputs[f.key] ?? "").trim().slice(0, 600) }))
    .filter((f) => f.value.length > 0);
  if (filled.length === 0) return "";
  return `\n\nReal-world inputs provided by the client for this specific deliverable (ground the output in these first, they are more reliable than anything inferred) :\n${filled
    .map((f) => `- ${f.label}: ${f.value}`)
    .join("\n")}`;
}

// "Génération automatique" path: figures the client already entered in the
// other modules (D01 capability levels, D02 flow map, L06 benefits), turned
// into prompt lines. Every derived figure comes from the modules' own pure
// calculators (computeFlow, computeObservedAnnual) — the AI only reads them.
// An invalid or empty source simply contributes no line.
export interface MeasuredDataInput {
  capabilities: { domain: string; observed: number; target: number; status: string }[];
  flow: { demand: number; steps: FlowStepInput[] } | null;
  benefits: { expectedAnnual: number | null; observations: BenefitObservationInput[] };
}

export function buildMeasuredDataLines(input: MeasuredDataInput): string[] {
  const lines: string[] = [];
  for (const c of input.capabilities) {
    lines.push(`Diagnostic D01 — ${c.domain} : niveau observé ${c.observed}/5, cible ${c.target}/5 (${c.status})`);
  }
  if (input.flow && validateFlowInputs(input.flow.steps, input.flow.demand).length === 0) {
    const { current } = computeFlow(input.flow.steps, input.flow.demand);
    lines.push(
      `Cartographie des flux D02 — délai total ${current.lead} j (traitement ${current.process} j, attente ${current.wait} j, soit ${current.waitShare} % d'attente) ; goulot : ${current.bottleneck.name} (${current.bottleneck.capacity} pièces/j) pour une demande de ${input.flow.demand} pièces/j`
    );
  }
  if (input.benefits.expectedAnnual !== null) {
    lines.push(`Bénéfices L06 — bénéfice annuel attendu : ${input.benefits.expectedAnnual}`);
  }
  const observed = computeObservedAnnual(input.benefits.observations);
  if (observed) {
    lines.push(
      `Bénéfices L06 — bénéfice annuel observé : ${observed.observedAnnual} (moyenne des ${observed.monthsUsed} derniers mois mesurés × 12)`
    );
  }
  return lines;
}

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
  // Figures already entered in other modules (diagnostic, flow map, benefits),
  // pre-formatted by buildMeasuredDataLines — the "automatic" path builds on
  // these when the client skips the questionnaire.
  measuredData?: string[];
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

// keyPoints pair every observation with its solution in the schema itself:
// the prompt rule "never a problem stated alone" is then enforced on parse,
// not just requested in prose.
const executiveReportContentSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z
    .array(z.object({ observation: z.string().min(1), solution: z.string().min(1) }))
    .min(2)
    .max(8),
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
  roadmap: `Produce a DETAILED EXECUTION VERSION of the already-chosen roadmap phases given below — same phase names and sequence, do not invent a new sequence or rename phases. For each phase: detailedActions (granular execution steps beyond the high-level ones already listed), dependencies (what must be true/done before this phase can start — internal or external), ownerSuggestion (what role/function should own this phase, e.g. "Responsable production" — never a named individual).
If the client listed priority actions, expected deliverables or milestones, place each one in the phase where it belongs (as a detailedAction, or a dependency for a milestone) — never drop or rephrase them away. Never write a calendar date yourself: dates come from the client's answers or the existing phase dates only.`,
  action_plan: `Concrete, short-term actions to start executing the chosen trajectory now. Each action: title, description (specific and actionable, never "improve X"), ownerSuggestion (role/function, not a named individual), timeframe (e.g. "Semaine 1-2", "Ce mois-ci").`,
  kpi_dashboard: `Build a KPI dashboard STRICTLY FROM the trajectory's own indicators given below — do not invent new, disconnected metrics. For each indicator you're given, produce one kpi entry: name (the indicator's own name), target (the indicator's own value if verified, or a reasonable near-term target framed clearly as such), current, unit, source ("trajectory" if it comes directly from a given indicator, "estimate" only if you had to add an operational KPI absent from the list — use "estimate" sparingly, at most 1-2 entries, and prefer one grounded in the "already measured" data below, e.g. the flow map's lead time or the benefits tracked).
"current" rules — never a guess: (1) if the client gave a measured baseline for this indicator, copy it verbatim; (2) else if the "already measured" data below contains this exact figure, copy it verbatim; (3) else null. Never derive, average or extrapolate a figure yourself.
If the client named who tracks an indicator, how often it is reviewed, its data source or an alert threshold, append it to that kpi's "name" in parentheses only when short (e.g. "Taux de service (resp. : qualité usine, hebdo)"), so the dashboard says who owns what.`,
  risk_map: `Execution risks specific to actually RUNNING this project — distinct from the trajectory's own strategic risks given below (do not just repeat them; think about implementation, adoption, resourcing, timing risks instead). Each risk: name, description, likelihood (low/medium/high), impact (low/medium/high), mitigation (a concrete counter-measure, never "monitor closely").`,
  executive_report: `A board-level synthesis of the chosen trajectory and its execution plan: summary (what's being done, why, and the expected outcome — 3 to 4 short sentences, never a longer block) + keyPoints (the handful of points a director must know before signing off).
${EXECUTIVE_NARRATIVE_RULES}
- keyPoints: each entry is an object { "observation", "solution" } — "observation" states one finding (a fact, a gap, a risk, a figure from the context); "solution" is the concrete recommendation that answers it, written right after it: who acts, what exactly, by when or at which phase. Never an observation without its solution, never a solution that just restates the problem ("monitor", "pay attention to", "improve X" are not solutions).`,
  toolkit: `Recommend practical tools/templates/frameworks that genuinely fit THIS project — a specific tracker type, a governance template, a specific methodology — never a generic "use a project management tool" list. Each tool: name, purpose, whyThisProject (why this specific project needs exactly this, not a generality).`,
};

const KIND_SCHEMA_BLOCK: Record<DeliverableKind, string> = {
  roadmap: `{ "phases": [{ "phaseName": string, "detailedActions": [string], "dependencies": [string], "ownerSuggestion": string }] }`,
  action_plan: `{ "actions": [{ "title": string, "description": string, "ownerSuggestion": string, "timeframe": string }] }`,
  kpi_dashboard: `{ "kpis": [{ "name": string, "target": string, "current": string|null, "unit": string, "source": "trajectory" | "estimate" }] }`,
  risk_map: `{ "risks": [{ "name": string, "description": string, "likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "mitigation": string }] }`,
  executive_report: `{ "summary": string, "keyPoints": [{ "observation": string, "solution": string }] }`,
  toolkit: `{ "tools": [{ "name": string, "purpose": string, "whyThisProject": string }] }`,
};

export function buildDeliverableSystemPrompt(kind: DeliverableKind, language: Language): string {
  return `You are the execution engine for "4 Tomorrow / Deliver" — this call produces exactly ONE deliverable, "${DELIVERABLE_LABELS[kind]}", for a transformation whose strategic trajectory has already been chosen and diagnosed by an earlier module (Decide). You are NOT choosing a strategy — you are turning an already-chosen one into an executable document.

STEP 0 — DOMAIN AWARENESS (internal reasoning): the domain(s) are given below — adapt vocabulary and content to fit (e.g. production/technical framing for manufacturing, commercial framing for go-to-market), never a generic template.

${KIND_INSTRUCTIONS[kind]}

CORE RULE — NEVER GENERIC: every sentence must contain something that would only be true for this exact project — a number, a name, a real constraint from the context given below. Ground everything in the trajectory/context provided; do not invent facts absent from it.

Also produce a "title" for this deliverable — a short, specific, domain-adapted name for it (e.g. "Go-to-market Plan — Lancement gamme XYZ" for a commercial trajectory rather than a generic "Roadmap"). This title is shown once the deliverable is opened — it is separate from and does not replace the fixed section name.

${languageInstruction(language)}

${RESULT_INSTRUCTION}

Schema:
{ "title": string, "content": ${KIND_SCHEMA_BLOCK[kind]} }`;
}

export function buildDeliverableUserPrompt(
  context: DeliverGenerationContext,
  kind?: DeliverableKind,
  inputs?: Record<string, string>
): string {
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
Priorités : ${context.priorities.map((p) => `${p.name} — ${p.reason}`).join("; ") || "(aucune)"}${
    context.measuredData && context.measuredData.length > 0
      ? `\n\nDonnées déjà mesurées dans les autres modules (chiffres exacts calculés par la plateforme — à reprendre tels quels, jamais recalculés ni extrapolés) :\n${context.measuredData.map((l) => `- ${l}`).join("\n")}`
      : ""
  }
${context.sourceDocText ? `\nDocument(s) projet fourni(s) (contexte supplémentaire) :\n${context.sourceDocText}` : ""}${
    kind && inputs ? buildInputsBlock(kind, inputs, { indicatorNames: Object.keys(context.indicators) }) : ""
  }`;
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

export function buildRecalibrationSystemPrompt(language: Language): string {
  return `You are the recalibration engine for "4 Tomorrow / Deliver". The user reports real execution progress, delays, or risks encountered on an already-running project (context and current priorities given below). Analyze it and propose an updated plan.

Produce:
- updatedPriorities: the priorities list, re-weighted (0-100, should sum roughly to 100) to reflect what the feedback reveals — carry forward priorities still valid, adjust weights, add a new one only if the feedback clearly reveals something not covered yet.
- recommendation: one concrete, specific paragraph on what to do next given this feedback — never generic reassurance.
- roadmapAdjustment: only if the feedback genuinely implies the roadmap phases need to change (a real delay, a phase now irrelevant, a new dependency) — set proposed:true with a clear note explaining why, and phaseChanges naming which phase(s) and what changes (a new end date and/or revised actions). If the feedback doesn't warrant a roadmap change, set proposed:false with a short note saying so, and phaseChanges: [].

CORE RULE — NEVER GENERIC: ground every point in what the user actually reported, never a generic "stay the course" or "monitor the situation".

This is a PROPOSAL ONLY — nothing here is applied automatically; the user reviews and confirms before anything changes.

${languageInstruction(language)}

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

export function buildRoadmapAdjustSystemPrompt(language: Language): string {
  return `You are the execution roadmap engine for "4 Tomorrow / Deliver". A roadmap for the already-chosen trajectory exists and some of its early phases are already done or in progress (listed below — do not repeat or contradict them). Your job is to REFRESH ONLY THE REMAINING phases, taking into account what has already been executed and updated priority sliders (0-100 each: cost control, CO2/sustainability-or-equivalent, risk mitigation, speed-to-impact).

Keep roughly the same remaining phase names and sequence given below unless the context genuinely calls for a different one — this is a refinement of what's left, not a from-scratch redesign. Each phase needs: name, durationWeeks, deliverables, actions, kpis — same standard as any roadmap: specific to this exact project, never generic.

How sliders influence the plan: a higher "speed" priority should compress remaining timelines and front-load quick wins; a higher "risk mitigation" priority should add or lengthen validation/testing; a higher "cost control" priority should favor phased, lower-commitment steps; a higher "CO2/sustainability" priority should foreground phases that de-risk or prove that angle early.

HARD ARRAY LIMITS — never exceed these, the response is rejected otherwise: deliverables ≤4, actions ≤4, kpis ≤3, per phase.

CORE RULE — NEVER GENERIC: same standard as the rest of 4 Tomorrow — every deliverable/action/kpi must contain something specific to this project.

${languageInstruction(language)}

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
