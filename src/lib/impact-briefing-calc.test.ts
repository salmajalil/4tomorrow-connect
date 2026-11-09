import { describe, expect, it } from "vitest";
import { buildExecutiveSnapshot, dayNumber, isWithinWindow, type ExecutiveSnapshotInput } from "./impact-briefing-calc";

const base: ExecutiveSnapshotInput = {
  risks: [],
  opportunities: [],
  actions: [],
  phases: [],
  ceoResponses: [],
  decision: null,
  today: "2026-11-08",
};

describe("dayNumber / isWithinWindow", () => {
  it("parses a date or a timestamp to the same UTC day", () => {
    expect(dayNumber("2026-11-08")).toBe(dayNumber("2026-11-08T23:59:00Z"));
    expect(dayNumber("not a date")).toBeNull();
    expect(dayNumber(null)).toBeNull();
  });

  it("includes today and the previous N-1 days, never the future", () => {
    expect(isWithinWindow("2026-11-08", "2026-11-08", 7)).toBe(true);
    expect(isWithinWindow("2026-11-02", "2026-11-08", 7)).toBe(true);
    expect(isWithinWindow("2026-11-01", "2026-11-08", 7)).toBe(false);
    expect(isWithinWindow("2026-11-09", "2026-11-08", 7)).toBe(false);
  });
});

describe("buildExecutiveSnapshot — achievements", () => {
  it("lists actions completed and phases finished within the week, most recent first", () => {
    const s = buildExecutiveSnapshot({
      ...base,
      actions: [
        { title: "Audit ligne 2", owner: "Qualité", dueDate: null, status: "done", completedAt: "2026-11-05T10:00:00Z" },
        { title: "Ancienne action", owner: null, dueDate: null, status: "done", completedAt: "2026-10-01T10:00:00Z" },
        { title: "En cours", owner: null, dueDate: null, status: "in_progress", completedAt: null },
      ],
      phases: [{ name: "Cadrage", status: "done", actualStartDate: "2026-10-01", actualEndDate: "2026-11-07" }],
    });
    expect(s.achievements.map((a) => a.label)).toEqual(["Cadrage", "Audit ligne 2"]);
    expect(s.achievements[0]).toMatchObject({ kind: "phase", date: "2026-11-07" });
  });

  it("never presents a done action without a completion date as this week's — it is only counted apart", () => {
    const s = buildExecutiveSnapshot({
      ...base,
      actions: [{ title: "Legacy", owner: null, dueDate: null, status: "done", completedAt: null }],
    });
    expect(s.achievements).toEqual([]);
    expect(s.undatedDoneActions).toBe(1);
  });
});

describe("buildExecutiveSnapshot — risks and hot spots", () => {
  const risks = [
    { name: "Fournisseur unique", reason: null, probability: 5, impact: 4, owner: "Achats", impactedObject: "Phase 2", createdAt: null },
    { name: "Turnover", reason: null, probability: 3, impact: 3, owner: null, impactedObject: null, createdAt: null },
    { name: "Non évalué", reason: null, probability: null, impact: null, owner: null, impactedObject: null, createdAt: null },
    { name: "Retard ERP", reason: null, probability: 4, impact: 3, owner: null, impactedObject: null, createdAt: null },
  ];

  it("puts critical risks (severity ≥ 15) in hot spots and ranks the rest by severity", () => {
    const s = buildExecutiveSnapshot({ ...base, risks });
    expect(s.hotSpots).toEqual([
      { kind: "critical_risk", label: "Fournisseur unique", severity: 20, owner: "Achats", impactedObject: "Phase 2" },
    ]);
    expect(s.risks.map((r) => [r.name, r.severity, r.zone])).toEqual([
      ["Retard ERP", 12, "élevé"],
      ["Turnover", 9, "modéré"],
      ["Non évalué", null, null],
    ]);
    expect(s.riskCount).toBe(4);
  });

  it("adds overdue, unfinished actions to hot spots with a computed delay, most late first", () => {
    const s = buildExecutiveSnapshot({
      ...base,
      actions: [
        { title: "Contrat intégrateur", owner: "DAF", dueDate: "2026-11-01", status: "in_progress", completedAt: null },
        { title: "Kick-off", owner: null, dueDate: "2026-10-20", status: "not_started", completedAt: null },
        { title: "Déjà fait", owner: null, dueDate: "2026-10-01", status: "done", completedAt: "2026-10-02T00:00:00Z" },
        { title: "À venir", owner: null, dueDate: "2026-12-01", status: "not_started", completedAt: null },
        { title: "Aujourd'hui", owner: null, dueDate: "2026-11-08", status: "not_started", completedAt: null },
      ],
    });
    expect(s.hotSpots).toEqual([
      { kind: "overdue_action", label: "Kick-off", owner: null, dueDate: "2026-10-20", daysLate: 19 },
      { kind: "overdue_action", label: "Contrat intégrateur", owner: "DAF", dueDate: "2026-11-01", daysLate: 7 },
    ]);
  });
});

describe("buildExecutiveSnapshot — team briefing", () => {
  it("rebuilds a dated, sorted activity list from the rows' own dates, within 30 days", () => {
    const s = buildExecutiveSnapshot({
      ...base,
      actions: [{ title: "Audit", owner: "Qualité", dueDate: null, status: "done", completedAt: "2026-11-06T09:00:00Z" }],
      phases: [{ name: "Pilote", status: "in_progress", actualStartDate: "2026-11-03", actualEndDate: null }],
      risks: [{ name: "Grève", reason: null, probability: null, impact: null, owner: null, impactedObject: "Jalon usine", createdAt: "2026-11-07T08:00:00Z" }],
      opportunities: [{ name: "Subvention", reason: null, createdAt: "2026-09-01T00:00:00Z" }],
      ceoResponses: [{ outcome: "validated", respondedAt: "2026-11-04T12:00:00Z" }],
      decision: { label: "Scénario équilibré", updatedAt: "2026-11-02T00:00:00Z" },
    });
    expect(s.teamBriefing.map((e) => [e.kind, e.date])).toEqual([
      ["risk_added", "2026-11-07"],
      ["action_done", "2026-11-06"],
      ["ceo_response", "2026-11-04"],
      ["phase_started", "2026-11-03"],
      ["decision_updated", "2026-11-02"],
    ]);
    expect(s.teamBriefing[0].detail).toBe("Jalon usine");
  });

  it("caps the briefing length and returns empty sections on an empty project", () => {
    const s = buildExecutiveSnapshot(base);
    expect(s).toMatchObject({ achievements: [], risks: [], opportunities: [], hotSpots: [], teamBriefing: [] });
    const many = buildExecutiveSnapshot({
      ...base,
      maxBriefingItems: 2,
      opportunities: ["a", "b", "c"].map((n) => ({ name: n, reason: null, createdAt: "2026-11-05T00:00:00Z" })),
    });
    expect(many.teamBriefing).toHaveLength(2);
    expect(many.opportunities).toHaveLength(3);
  });
});
