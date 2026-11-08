import { describe, expect, it } from "vitest";
import {
  validateWeights,
  weightedScore,
  rankScenarios,
  pickWinner,
  computeSensitivity,
  equalWeights,
  canShowRadar,
  rebalanceWeights,
  type ScenarioScoreInput,
} from "./decide-scenario-calc";

describe("validateWeights", () => {
  it("accepts weights that sum exactly to 100", () => {
    expect(validateWeights({ cost: 40, risk: 35, roi: 25 })).toEqual([]);
  });

  it("rejects weights that don't sum to 100", () => {
    const errors = validateWeights({ cost: 40, risk: 35, roi: 20 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("100");
  });

  it("rejects a weight outside 0-100", () => {
    const errors = validateWeights({ cost: 120, risk: -20 });
    expect(errors.some((e) => e.includes("cost"))).toBe(true);
    expect(errors.some((e) => e.includes("risk"))).toBe(true);
  });

  it("rejects an empty weight set", () => {
    expect(validateWeights({})).toHaveLength(1);
  });

  it("tolerates floating-point rounding noise", () => {
    expect(validateWeights({ a: 33.33, b: 33.33, c: 33.34 })).toEqual([]);
  });
});

describe("weightedScore", () => {
  it("computes the weighted sum on a 0-10 scale", () => {
    const score = weightedScore({ cost: 8, risk: 4, roi: 6 }, { cost: 50, risk: 30, roi: 20 });
    // 0.5*8 + 0.3*4 + 0.2*6 = 4 + 1.2 + 1.2 = 6.4
    expect(score).toBeCloseTo(6.4);
  });

  it("treats a missing axis score as 0", () => {
    const score = weightedScore({ cost: 10 }, { cost: 50, risk: 50 });
    expect(score).toBeCloseTo(5); // 0.5*10 + 0.5*0
  });
});

describe("rankScenarios — veto never finishes first", () => {
  const weights = { cost: 50, risk: 50 };

  it("ranks by weighted score when nothing is vetoed", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 5, risk: 5 }, veto: false },
      { trajectoryId: "B", scores: { cost: 9, risk: 9 }, veto: false },
    ];
    const ranked = rankScenarios(scenarios, weights);
    expect(ranked[0].trajectoryId).toBe("B");
  });

  it("never ranks a vetoed option first, even if it scores highest", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 3, risk: 3 }, veto: false },
      { trajectoryId: "B", scores: { cost: 10, risk: 10 }, veto: true },
    ];
    const ranked = rankScenarios(scenarios, weights);
    expect(ranked[0].trajectoryId).toBe("A");
    expect(ranked[ranked.length - 1].trajectoryId).toBe("B");
  });

  it("is deterministic on a tie (stable order by trajectoryId)", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "Z", scores: { cost: 5, risk: 5 }, veto: false },
      { trajectoryId: "A", scores: { cost: 5, risk: 5 }, veto: false },
    ];
    const ranked = rankScenarios(scenarios, weights);
    expect(ranked[0].trajectoryId).toBe("A");
  });
});

describe("pickWinner", () => {
  it("returns null when every scenario is vetoed", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 9 }, veto: true },
      { trajectoryId: "B", scores: { cost: 8 }, veto: true },
    ];
    const winner = pickWinner(rankScenarios(scenarios, { cost: 100 }));
    expect(winner).toBeNull();
  });
});

describe("computeSensitivity", () => {
  it("flags no flip when the winner is robust to ±10pt weight changes", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 10, risk: 10 }, veto: false },
      { trajectoryId: "B", scores: { cost: 1, risk: 1 }, veto: false },
    ];
    const result = computeSensitivity(scenarios, { cost: 50, risk: 50 });
    expect(result.stable).toBe(true);
    expect(result.flips).toEqual([]);
  });

  it("detects a flip when a ±10pt weight change changes the winner", () => {
    // A wins on cost, B wins on risk, scores close enough that shifting
    // weight toward risk by 10pts flips the winner from A to B.
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 10, risk: 0 }, veto: false },
      { trajectoryId: "B", scores: { cost: 0, risk: 10 }, veto: false },
    ];
    // At 51/49 cost/risk, A wins by a hair; +10 on risk (→ 41/59) flips it to B.
    const result = computeSensitivity(scenarios, { cost: 51, risk: 49 });
    expect(result.stable).toBe(false);
    expect(result.flips.some((f) => f.axis === "risk" && f.delta === 10 && f.newWinnerId === "B")).toBe(true);
  });

  it("never reports a flip into a vetoed option", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 6, risk: 4 }, veto: false },
      { trajectoryId: "B", scores: { cost: 4, risk: 10 }, veto: true },
    ];
    const result = computeSensitivity(scenarios, { cost: 50, risk: 50 });
    expect(result.flips.every((f) => f.newWinnerId !== "B")).toBe(true);
  });
});

describe("equalWeights", () => {
  it("splits 100 evenly and always sums to exactly 100", () => {
    const weights = equalWeights(["cost", "risk", "roi"]);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(validateWeights(weights)).toEqual([]);
  });

  it("returns an empty object for no axes", () => {
    expect(equalWeights([])).toEqual({});
  });
});

describe("canShowRadar", () => {
  it("rejects below 3 axes (no shape)", () => {
    expect(canShowRadar(0)).toBe(false);
    expect(canShowRadar(2)).toBe(false);
  });

  it("accepts 3 to 6 axes (brief D04: ≤ 6 critères)", () => {
    expect(canShowRadar(3)).toBe(true);
    expect(canShowRadar(5)).toBe(true);
    expect(canShowRadar(6)).toBe(true);
  });

  it("rejects above 6 axes (too cramped to read)", () => {
    expect(canShowRadar(7)).toBe(false);
    expect(canShowRadar(12)).toBe(false);
  });
});

describe("rebalanceWeights", () => {
  const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

  it("sets the moved weight and spreads the rest proportionally", () => {
    expect(rebalanceWeights({ cost: 40, risk: 40, roi: 20 }, "cost", 60)).toEqual({ cost: 60, risk: 27, roi: 13 });
  });

  it("always returns integers summing to exactly 100", () => {
    const w = rebalanceWeights({ a: 34, b: 33, c: 33 }, "a", 51);
    expect(sum(w)).toBe(100);
    expect(Object.values(w).every(Number.isInteger)).toBe(true);
    expect(validateWeights(w)).toEqual([]);
  });

  it("keeps the other criteria's relative weights", () => {
    const w = rebalanceWeights({ a: 20, b: 60, c: 20 }, "a", 60);
    expect(w).toEqual({ a: 60, b: 30, c: 10 });
  });

  it("splits evenly when every other weight is 0", () => {
    expect(rebalanceWeights({ a: 100, b: 0, c: 0 }, "a", 40)).toEqual({ a: 40, b: 30, c: 30 });
  });

  it("clamps and rounds the moved value", () => {
    expect(rebalanceWeights({ a: 50, b: 50 }, "a", 130)).toEqual({ a: 100, b: 0 });
    expect(rebalanceWeights({ a: 50, b: 50 }, "a", -5)).toEqual({ a: 0, b: 100 });
    expect(rebalanceWeights({ a: 50, b: 50 }, "a", 33.6)).toEqual({ a: 34, b: 66 });
  });

  it("puts 100 on a single criterion", () => {
    expect(rebalanceWeights({ a: 100 }, "a", 20)).toEqual({ a: 100 });
  });

  it("ignores an unknown criterion and keeps key order", () => {
    expect(rebalanceWeights({ a: 50, b: 50 }, "z", 10)).toEqual({ a: 50, b: 50 });
    expect(Object.keys(rebalanceWeights({ x: 10, y: 30, z: 60 }, "z", 20))).toEqual(["x", "y", "z"]);
  });

  it("feeds straight into rankScenarios: moving a weight can change the winner", () => {
    const scenarios: ScenarioScoreInput[] = [
      { trajectoryId: "A", scores: { cost: 9, risk: 2 }, veto: false },
      { trajectoryId: "B", scores: { cost: 3, risk: 8 }, veto: false },
    ];
    expect(rankScenarios(scenarios, { cost: 50, risk: 50 })[0].trajectoryId).toBe("A");
    const moved = rebalanceWeights({ cost: 50, risk: 50 }, "risk", 80);
    expect(rankScenarios(scenarios, moved)[0].trajectoryId).toBe("B");
  });
});
