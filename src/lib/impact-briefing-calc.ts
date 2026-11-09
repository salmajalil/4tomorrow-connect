// Rapport CEO — bloc du haut (achievements / risques / opportunités / points
// chauds) et briefing équipe. Fonctions pures : tri, filtrage par date et
// décomptes de jours uniquement, à partir de lignes déjà saisies (actions,
// risques, opportunités, phases de roadmap, réponses CEO). Jamais d'IA,
// jamais de réseau, jamais de valeur inventée : une action terminée sans
// date d'achèvement enregistrée n'est pas présentée comme "de la semaine",
// elle est seulement décomptée à part.
import { computeRiskSeverity, riskZone, type RiskZone } from "@/lib/risk-scoring";

export interface SnapshotRisk {
  name: string;
  reason: string | null;
  probability: number | null;
  impact: number | null;
  owner: string | null;
  impactedObject: string | null;
  createdAt: string | null;
}

export interface SnapshotOpportunity {
  name: string;
  reason: string | null;
  createdAt: string | null;
}

export interface SnapshotAction {
  title: string;
  owner: string | null;
  dueDate: string | null; // "YYYY-MM-DD"
  status: "not_started" | "in_progress" | "done";
  completedAt: string | null; // timestamptz, posé par la base (0026)
}

export interface SnapshotPhase {
  name: string;
  status: "upcoming" | "in_progress" | "done";
  actualStartDate: string | null;
  actualEndDate: string | null;
}

export interface SnapshotCeoResponse {
  outcome: "validated" | "needs_more_info" | "rejected";
  respondedAt: string;
}

export interface ExecutiveSnapshotInput {
  risks: SnapshotRisk[];
  opportunities: SnapshotOpportunity[];
  actions: SnapshotAction[];
  phases: SnapshotPhase[];
  ceoResponses: SnapshotCeoResponse[];
  // Scénario retenu et date de son dernier changement (decision_updated_at) ;
  // null tant qu'aucun scénario n'est retenu.
  decision: { label: string; updatedAt: string } | null;
  today: string; // "YYYY-MM-DD"
  achievementsWindowDays?: number; // défaut 7 — "de la semaine"
  briefingWindowDays?: number; // défaut 30
  maxPerSection?: number; // défaut 3
  maxBriefingItems?: number; // défaut 10
}

export type Achievement = { kind: "action" | "phase"; label: string; owner: string | null; date: string };

export type RankedRisk = SnapshotRisk & { severity: number | null; zone: RiskZone | null };

export type HotSpot =
  | { kind: "critical_risk"; label: string; severity: number; owner: string | null; impactedObject: string | null }
  | { kind: "overdue_action"; label: string; owner: string | null; dueDate: string; daysLate: number };

export type BriefingEventKind =
  | "action_done"
  | "phase_done"
  | "phase_started"
  | "risk_added"
  | "opportunity_added"
  | "ceo_response"
  | "decision_updated";

export type BriefingEvent = { kind: BriefingEventKind; label: string; date: string; detail: string | null };

export interface ExecutiveSnapshot {
  achievements: Achievement[];
  undatedDoneActions: number; // actions "terminées" sans date d'achèvement connue
  risks: RankedRisk[]; // hors risques critiques (ceux-là sont dans hotSpots)
  riskCount: number;
  opportunities: SnapshotOpportunity[];
  opportunityCount: number;
  hotSpots: HotSpot[];
  teamBriefing: BriefingEvent[];
}

/** "YYYY-MM-DD" (ou timestamp ISO) → nombre de jours depuis l'époque, en UTC. null si invalide. */
export function dayNumber(isoDateOrTimestamp: string | null | undefined): number | null {
  if (!isoDateOrTimestamp) return null;
  const day = isoDateOrTimestamp.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

/** Vrai si la date tombe dans les `windowDays` derniers jours (aujourd'hui inclus, jamais dans le futur). */
export function isWithinWindow(date: string | null | undefined, today: string, windowDays: number): boolean {
  const d = dayNumber(date);
  const t = dayNumber(today);
  if (d === null || t === null) return false;
  return d <= t && t - d < windowDays;
}

function byDateDesc<T extends { date: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date);
}

export function buildExecutiveSnapshot(input: ExecutiveSnapshotInput): ExecutiveSnapshot {
  const achievementsWindow = input.achievementsWindowDays ?? 7;
  const briefingWindow = input.briefingWindowDays ?? 30;
  const maxPerSection = input.maxPerSection ?? 3;
  const maxBriefing = input.maxBriefingItems ?? 10;
  const todayNum = dayNumber(input.today);

  // Achievements — actions passées à "terminé" + phases de roadmap
  // terminées, dans la fenêtre, datées par la base (jamais devinées).
  const achievements: Achievement[] = [
    ...input.actions
      .filter((a) => a.status === "done" && a.completedAt && isWithinWindow(a.completedAt, input.today, achievementsWindow))
      .map((a) => ({ kind: "action" as const, label: a.title, owner: a.owner, date: (a.completedAt as string).slice(0, 10) })),
    ...input.phases
      .filter((p) => p.status === "done" && p.actualEndDate && isWithinWindow(p.actualEndDate, input.today, achievementsWindow))
      .map((p) => ({ kind: "phase" as const, label: p.name, owner: null, date: (p.actualEndDate as string).slice(0, 10) })),
  ].sort(byDateDesc);
  const undatedDoneActions = input.actions.filter((a) => a.status === "done" && !a.completedAt).length;

  // Risques — sévérité et palier toujours issus de risk-scoring.ts.
  const ranked: RankedRisk[] = input.risks
    .map((r) => {
      const { severity } = computeRiskSeverity({ probability: r.probability, impact: r.impact });
      return { ...r, severity, zone: riskZone(severity) };
    })
    .sort((a, b) => {
      if (a.severity === null && b.severity === null) return a.name.localeCompare(b.name);
      if (a.severity === null) return 1;
      if (b.severity === null) return -1;
      return b.severity - a.severity || a.name.localeCompare(b.name);
    });
  const critical = ranked.filter((r) => r.zone === "critique");
  const nonCritical = ranked.filter((r) => r.zone !== "critique");

  const overdue =
    todayNum === null
      ? []
      : input.actions
          .filter((a) => a.status !== "done" && a.dueDate !== null)
          .map((a) => ({ a, due: dayNumber(a.dueDate) }))
          .filter((x): x is { a: SnapshotAction; due: number } => x.due !== null && x.due < todayNum)
          .map(({ a, due }) => ({
            kind: "overdue_action" as const,
            label: a.title,
            owner: a.owner,
            dueDate: (a.dueDate as string).slice(0, 10),
            daysLate: todayNum - due,
          }))
          .sort((x, y) => y.daysLate - x.daysLate || x.label.localeCompare(y.label));

  const hotSpots: HotSpot[] = [
    ...critical.map((r) => ({
      kind: "critical_risk" as const,
      label: r.name,
      severity: r.severity as number,
      owner: r.owner,
      impactedObject: r.impactedObject,
    })),
    ...overdue,
  ];

  const opportunities = [...input.opportunities].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  // Briefing équipe — journal reconstitué à partir des dates déjà
  // enregistrées sur chaque ligne (aucune table de log dédiée n'existe).
  const events: BriefingEvent[] = [];
  for (const a of input.actions) {
    if (a.status === "done" && a.completedAt && isWithinWindow(a.completedAt, input.today, briefingWindow)) {
      events.push({ kind: "action_done", label: a.title, date: a.completedAt.slice(0, 10), detail: a.owner });
    }
  }
  for (const p of input.phases) {
    if (p.actualEndDate && p.status === "done" && isWithinWindow(p.actualEndDate, input.today, briefingWindow)) {
      events.push({ kind: "phase_done", label: p.name, date: p.actualEndDate.slice(0, 10), detail: null });
    }
    if (p.actualStartDate && p.status !== "upcoming" && isWithinWindow(p.actualStartDate, input.today, briefingWindow)) {
      events.push({ kind: "phase_started", label: p.name, date: p.actualStartDate.slice(0, 10), detail: null });
    }
  }
  for (const r of input.risks) {
    if (r.createdAt && isWithinWindow(r.createdAt, input.today, briefingWindow)) {
      events.push({ kind: "risk_added", label: r.name, date: r.createdAt.slice(0, 10), detail: r.impactedObject });
    }
  }
  for (const o of input.opportunities) {
    if (o.createdAt && isWithinWindow(o.createdAt, input.today, briefingWindow)) {
      events.push({ kind: "opportunity_added", label: o.name, date: o.createdAt.slice(0, 10), detail: null });
    }
  }
  for (const c of input.ceoResponses) {
    if (isWithinWindow(c.respondedAt, input.today, briefingWindow)) {
      events.push({ kind: "ceo_response", label: c.outcome, date: c.respondedAt.slice(0, 10), detail: null });
    }
  }
  if (input.decision && isWithinWindow(input.decision.updatedAt, input.today, briefingWindow)) {
    events.push({ kind: "decision_updated", label: input.decision.label, date: input.decision.updatedAt.slice(0, 10), detail: null });
  }
  // Tri stable : date décroissante, puis type, puis libellé — même entrée,
  // même sortie.
  events.sort((a, b) => byDateDesc(a, b) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));

  return {
    achievements,
    undatedDoneActions,
    risks: nonCritical.slice(0, maxPerSection),
    riskCount: input.risks.length,
    opportunities: opportunities.slice(0, maxPerSection),
    opportunityCount: input.opportunities.length,
    hotSpots,
    teamBriefing: events.slice(0, maxBriefing),
  };
}
