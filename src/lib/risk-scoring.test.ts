import { describe, expect, it } from "vitest";
import { computeRiskSeverity, rankRisksBySeverity, riskZone } from "./risk-scoring";

describe("computeRiskSeverity", () => {
  it("multiplies probability by impact when both are set", () => {
    expect(computeRiskSeverity({ probability: 4, impact: 3 })).toEqual({ status: "évalué", severity: 12 });
  });

  it("reports non évalué when probability is missing", () => {
    expect(computeRiskSeverity({ probability: null, impact: 3 })).toEqual({ status: "non évalué", severity: null });
  });

  it("reports non évalué when impact is missing", () => {
    expect(computeRiskSeverity({ probability: 4, impact: null })).toEqual({ status: "non évalué", severity: null });
  });

  it("reports non évalué when both are missing", () => {
    expect(computeRiskSeverity({ probability: null, impact: null })).toEqual({ status: "non évalué", severity: null });
  });

  it("rejects out-of-range values as non évalué", () => {
    expect(computeRiskSeverity({ probability: 6, impact: 3 }).status).toBe("non évalué");
    expect(computeRiskSeverity({ probability: 0, impact: 3 }).status).toBe("non évalué");
  });

  it("covers the full 1-25 range at the extremes", () => {
    expect(computeRiskSeverity({ probability: 1, impact: 1 }).severity).toBe(1);
    expect(computeRiskSeverity({ probability: 5, impact: 5 }).severity).toBe(25);
  });
});

describe("rankRisksBySeverity", () => {
  it("sorts by severity descending", () => {
    const risks = [
      { name: "A", probability: 2, impact: 2 }, // 4
      { name: "B", probability: 5, impact: 5 }, // 25
      { name: "C", probability: 3, impact: 3 }, // 9
    ];
    expect(rankRisksBySeverity(risks).map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("pushes unevaluated risks to the end regardless of name", () => {
    const risks = [
      { name: "AAA-unscored", probability: null, impact: null },
      { name: "ZZZ-scored", probability: 3, impact: 3 },
    ];
    expect(rankRisksBySeverity(risks).map((r) => r.name)).toEqual(["ZZZ-scored", "AAA-unscored"]);
  });

  it("breaks ties alphabetically by name", () => {
    const risks = [
      { name: "Zèbre", probability: 3, impact: 3 },
      { name: "Alpha", probability: 3, impact: 3 },
    ];
    expect(rankRisksBySeverity(risks).map((r) => r.name)).toEqual(["Alpha", "Zèbre"]);
  });

  it("never invents a severity — output severity is always derived from the given probability/impact", () => {
    const risks = [{ name: "X", probability: 2, impact: 4 }];
    const [result] = rankRisksBySeverity(risks);
    expect(result.severity).toBe(8);
  });
});

describe("riskZone", () => {
  it("returns null for a non-evaluated risk", () => {
    expect(riskZone(null)).toBeNull();
  });

  it("classifies the four ISO 31000-style tiers by severity", () => {
    expect(riskZone(1)).toBe("faible");
    expect(riskZone(4)).toBe("faible");
    expect(riskZone(5)).toBe("modéré");
    expect(riskZone(9)).toBe("modéré");
    expect(riskZone(10)).toBe("élevé");
    expect(riskZone(14)).toBe("élevé");
    expect(riskZone(15)).toBe("critique");
    expect(riskZone(25)).toBe("critique");
  });
});
