import { describe, expect, it } from "vitest";
import {
  validateWeights,
  weightedScore,
  rankScenarios,
  pickWinner,
  computeSensitivity,
  equalWeights,
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
