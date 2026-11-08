// D02 — Cartographie dynamique : calcul déterministe, côté serveur. Aucune
// valeur ici ne vient de l'IA — délai/goulot/couverture de la demande sont
// calculés uniquement à partir des étapes saisies ou importées par
// l'utilisateur (traitement, attente, capacité) et de la demande.
//
// Règles (brief D02) :
//   délai = traitement + attente ;
//   goulot = poste de plus faible capacité, comparé à la demande ;
//   leviers « et si » appliqués sur une copie des données, jamais sur
//     l'original ;
//   mise à jour par import (voir parseFlowCsv) ;
//   une nouvelle donnée marque les écrans liés « à revoir » (voir
//     FlowView — comparaison du dernier calcul aux données courantes).

export interface FlowStepInput {
  id: string;
  name: string;
  process: number; // traitement, en jours, >= 0
  wait: number; // attente, en jours, >= 0
  capacity: number; // capacité, en pièces/jour, > 0
}

export interface FlowLevers {
  waitCut: Record<string, number>; // % (0-100) de réduction d'attente, par étape
  capAdd: Record<string, number>; // capacité additionnelle (>= 0), par étape
}

export function emptyLevers(): FlowLevers {
  return { waitCut: {}, capAdd: {} };
}

export interface FlowBottleneck {
  id: string;
  name: string;
  capacity: number;
}

export interface FlowSummary {
  process: number;
  wait: number;
  lead: number; // délai = traitement + attente
  waitShare: number; // % du délai total qui est de l'attente
  bottleneck: FlowBottleneck; // poste de plus faible capacité
  demandCovered: boolean; // capacité du goulot >= demande
  throughput: number; // débit réel = min(capacité du goulot, demande)
  deficit: number; // manque de capacité face à la demande (jamais négatif)
}

export interface FlowResult {
  current: FlowSummary;
  simulated: FlowSummary;
  simSteps: FlowStepInput[];
  gainDays: number; // délai actuel - délai simulé (positif = amélioration)
}

function isFiniteNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/** Valide les étapes et la demande ; retourne la liste des erreurs (vide = valide). */
export function validateFlowInputs(steps: FlowStepInput[], demand: number): string[] {
  const errors: string[] = [];
  if (steps.length === 0) {
    errors.push("Au moins une étape est nécessaire.");
  }
  for (const step of steps) {
    const label = step.name.trim() || `étape sans nom (id ${step.id})`;
    if (!step.name.trim()) {
      errors.push(`${label} : le nom de l'étape est obligatoire.`);
    }
    if (!isFiniteNonNegative(step.process)) {
      errors.push(`${label} : le traitement doit être un nombre de jours positif ou nul.`);
    }
    if (!isFiniteNonNegative(step.wait)) {
      errors.push(`${label} : l'attente doit être un nombre de jours positif ou nul.`);
    }
    if (!Number.isFinite(step.capacity) || step.capacity <= 0) {
      errors.push(`${label} : la capacité doit être un nombre de pièces/jour strictement positif.`);
    }
  }
  if (!isFiniteNonNegative(demand)) {
    errors.push("La demande doit être un nombre de pièces/jour positif ou nul.");
  }
  return errors;
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * Applique les leviers « et si » sur une copie des étapes — l'original
 * (`steps`) n'est jamais modifié, conformément au brief.
 */
function applyLevers(steps: FlowStepInput[], levers: FlowLevers): FlowStepInput[] {
  return steps.map((s) => ({
    ...s,
    wait: s.wait * (1 - clampPercent(levers.waitCut[s.id] ?? 0) / 100),
    capacity: s.capacity + Math.max(0, levers.capAdd[s.id] ?? 0),
  }));
}

function summarize(steps: FlowStepInput[], demand: number): FlowSummary {
  const process = steps.reduce((total, s) => total + s.process, 0);
  const wait = steps.reduce((total, s) => total + s.wait, 0);
  const lead = process + wait;
  // Goulot = poste de plus faible capacité. Déterministe : à égalité de
  // capacité, le premier poste rencontré (ordre de saisie) est retenu.
  const bottleneckStep = steps.reduce((min, s) => (s.capacity < min.capacity ? s : min), steps[0]);
  const bottleneck: FlowBottleneck = { id: bottleneckStep.id, name: bottleneckStep.name, capacity: bottleneckStep.capacity };
  const throughput = Math.min(bottleneck.capacity, demand);
  return {
    process: round(process),
    wait: round(wait),
    lead: round(lead),
    waitShare: lead > 0 ? round((wait / lead) * 100) : 0,
    bottleneck,
    demandCovered: bottleneck.capacity >= demand,
    throughput: round(throughput),
    deficit: round(Math.max(0, demand - bottleneck.capacity)),
  };
}

/**
 * Fonction pure : mêmes entrées => mêmes sorties, jamais d'appel réseau ni
 * d'IA. `steps` n'est jamais muté — les leviers s'appliquent sur `simSteps`,
 * une copie (voir applyLevers).
 */
export function computeFlow(steps: FlowStepInput[], demand: number, levers: FlowLevers = emptyLevers()): FlowResult {
  const simSteps = applyLevers(steps, levers);
  const current = summarize(steps, demand);
  const simulated = summarize(simSteps, demand);
  return { current, simulated, simSteps, gainDays: round(current.lead - simulated.lead) };
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

// ---------------------------------------------------------------------------
// Import CSV — « un modèle d'import téléchargeable… message d'erreur qui dit
// la ligne et quoi corriger » (brief D02). Format attendu : une ligne d'en-
// tête "étape;traitement;attente;capacité" puis une ligne par étape. Les
// nombres acceptent la virgule décimale (locale FR).
// ---------------------------------------------------------------------------

export const FLOW_CSV_HEADER = "étape;traitement;attente;capacité";
export const FLOW_CSV_TEMPLATE = `${FLOW_CSV_HEADER}\nRéception;1;2;120\nContrôle;0.5;1;80\nExpédition;1;0.5;150\n`;

const EXPECTED_HEADER_COLS = ["etape", "traitement", "attente", "capacite"];

function normalizeHeaderCell(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface FlowCsvParseResult {
  steps: FlowStepInput[];
  errors: string[];
}

/** Parse un CSV « étape;traitement;attente;capacité » en étapes, avec des erreurs localisées par ligne. */
export function parseFlowCsv(text: string): FlowCsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { steps: [], errors: ["Le fichier est vide."] };
  }

  const header = lines[0].split(";").map(normalizeHeaderCell);
  const headerMatches = EXPECTED_HEADER_COLS.every((col, i) => header[i] === col);
  const dataLines = headerMatches ? lines.slice(1) : lines;
  const firstDataLineNumber = headerMatches ? 2 : 1;

  const errors: string[] = [];
  if (!headerMatches) {
    errors.push(
      `Ligne 1 : en-tête attendu "${FLOW_CSV_HEADER}" — chaque ligne du fichier a été traitée comme une étape, en-tête inclus si mal formé.`
    );
  }

  const steps: FlowStepInput[] = [];
  dataLines.forEach((line, idx) => {
    const lineNumber = firstDataLineNumber + idx;
    const cols = line.split(";").map((c) => c.trim());
    if (cols.length !== 4) {
      errors.push(`Ligne ${lineNumber} : 4 colonnes attendues (${FLOW_CSV_HEADER}), ${cols.length} trouvée(s).`);
      return;
    }
    const [name, processRaw, waitRaw, capacityRaw] = cols;
    if (!name) {
      errors.push(`Ligne ${lineNumber} : le nom de l'étape est vide.`);
      return;
    }
    const process = Number(processRaw.replace(",", "."));
    const wait = Number(waitRaw.replace(",", "."));
    const capacity = Number(capacityRaw.replace(",", "."));
    if (!isFiniteNonNegative(process)) {
      errors.push(`Ligne ${lineNumber} : le traitement doit être un nombre de jours positif ou nul (lu : "${processRaw}").`);
      return;
    }
    if (!isFiniteNonNegative(wait)) {
      errors.push(`Ligne ${lineNumber} : l'attente doit être un nombre de jours positif ou nul (lu : "${waitRaw}").`);
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      errors.push(`Ligne ${lineNumber} : la capacité doit être un nombre de pièces/jour strictement positif (lu : "${capacityRaw}").`);
      return;
    }
    steps.push({ id: `step-${lineNumber}`, name, process, wait, capacity });
  });

  return { steps, errors };
}

/** Signature stable des entrées (étapes + demande + leviers) — utilisée côté UI pour détecter un résultat « à revoir ». */
export function flowInputsSignature(steps: FlowStepInput[], demand: number, levers: FlowLevers): string {
  return JSON.stringify({ steps, demand, levers });
}
