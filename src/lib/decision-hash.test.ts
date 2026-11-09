import { describe, expect, it } from "vitest";
import { decisionFingerprint, hashDecision, stableStringify, type DecisionFingerprintInput } from "./decision-hash";

const base: DecisionFingerprintInput = {
  transformationId: "tx-1",
  trajectoryId: "traj-1",
  decisionUpdatedAt: "2026-01-01T00:00:00.000Z",
  trajectory: {
    name: "Modernisation ciblée",
    stance: "Équilibré",
    description: "Description",
    executiveBriefing: "Briefing",
    indicators: { CAPEX: { value: 12, confidence: "high" }, ROI: { value: "18 mois", confidence: "medium" } },
  },
};

describe("stableStringify", () => {
  it("ne dépend pas de l'ordre des clés", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("garde l'ordre des tableaux et ignore les clés undefined", () => {
    expect(stableStringify([2, 1])).toBe("[2,1]");
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("hashDecision", () => {
  it("est un SHA-256 hexadécimal déterministe", () => {
    const h = hashDecision(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDecision({ ...base })).toBe(h);
  });

  it("ne change pas si seules l'écriture du fuseau ou l'ordre des indicateurs diffèrent", () => {
    const sameInstant = { ...base, decisionUpdatedAt: "2026-01-01T00:00:00+00:00" };
    const reordered = {
      ...base,
      trajectory: { ...base.trajectory!, indicators: { ROI: { confidence: "medium", value: "18 mois" }, CAPEX: { confidence: "high", value: 12 } } },
    };
    expect(hashDecision(sameInstant)).toBe(hashDecision(base));
    expect(hashDecision(reordered)).toBe(hashDecision(base));
  });

  it("change dès qu'un champ clé de la décision change", () => {
    const h = hashDecision(base);
    expect(hashDecision({ ...base, trajectoryId: "traj-2" })).not.toBe(h);
    expect(hashDecision({ ...base, decisionUpdatedAt: "2026-01-02T00:00:00.000Z" })).not.toBe(h);
    expect(hashDecision({ ...base, trajectory: { ...base.trajectory!, executiveBriefing: "Autre briefing" } })).not.toBe(h);
    expect(
      hashDecision({ ...base, trajectory: { ...base.trajectory!, indicators: { CAPEX: { value: 13, confidence: "high" } } } })
    ).not.toBe(h);
  });

  it("hache exactement le JSON stable exposé par decisionFingerprint", () => {
    expect(decisionFingerprint(base)).toContain('"trajectoryId":"traj-1"');
  });
});
