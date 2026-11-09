import { describe, expect, it } from "vitest";
import {
  capabilityAssessmentProgress,
  computeCapabilityGaps,
  rankCapabilityGaps,
  validateCapabilityInputs,
  type CapabilityAssessmentInput,
} from "./decide-diagnostic-calc";

function input(overrides: Partial<CapabilityAssessmentInput> = {}): CapabilityAssessmentInput {
  return {
    domain: "manufacturing",
    observed: 2,
    target: 4,
    importance: 3,
    proofNote: "",
    ...overrides,
  };
}

describe("computeCapabilityGaps", () => {
  it("computes gap = target - observed", () => {
    const [result] = computeCapabilityGaps([input({ observed: 2, target: 4 })]);
    expect(result.gap).toBe(2);
  });

  it("computes priority = gap * importance", () => {
    const [result] = computeCapabilityGaps([input({ observed: 2, target: 4, importance: 3 })]);
    expect(result.priority).toBe(6); // gap(2) * importance(3)
  });

  it("clamps gap to 0 when observed exceeds target (never negative)", () => {
    const [result] = computeCapabilityGaps([input({ observed: 5, target: 2 })]);
    expect(result.gap).toBe(0);
    expect(result.priority).toBe(0);
  });

  it("returns gap 0 when observed equals target", () => {
    const [result] = computeCapabilityGaps([input({ observed: 3, target: 3 })]);
    expect(result.gap).toBe(0);
  });

  it("marks a capability with no proof note as non vérifié", () => {
    const [result] = computeCapabilityGaps([input({ proofNote: "" })]);
    expect(result.status).toBe("non vérifié");
  });

  it("marks a capability with a proof note as vérifié", () => {
    const [result] = computeCapabilityGaps([input({ proofNote: "Audit interne Q3 2026, page 4" })]);
    expect(result.status).toBe("vérifié");
  });

  it("treats a whitespace-only proof note as no proof (stays non vérifié)", () => {
    const [result] = computeCapabilityGaps([input({ proofNote: "   " })]);
    expect(result.status).toBe("non vérifié");
  });

  it("trims the stored proof note", () => {
    const [result] = computeCapabilityGaps([input({ proofNote: "  preuve chiffrée  " })]);
    expect(result.proofNote).toBe("preuve chiffrée");
  });

  it("is a pure function: same input always yields the same output", () => {
    const i = input({ observed: 1, target: 5, importance: 4, proofNote: "x" });
    expect(computeCapabilityGaps([i])).toEqual(computeCapabilityGaps([i]));
  });
});

describe("rankCapabilityGaps", () => {
  it("sorts by priority descending", () => {
    const results = computeCapabilityGaps([
      input({ domain: "manufacturing", observed: 3, target: 4, importance: 2 }), // gap1 * imp2 = 2
      input({ domain: "rd", observed: 1, target: 5, importance: 3 }), // gap4 * imp3 = 12
      input({ domain: "gtm", observed: 2, target: 3, importance: 1 }), // gap1 * imp1 = 1
    ]);
    const ranked = rankCapabilityGaps(results);
    expect(ranked.map((r) => r.domain)).toEqual(["rd", "manufacturing", "gtm"]);
  });

  it("breaks a priority tie using the larger raw gap", () => {
    const results = computeCapabilityGaps([
      input({ domain: "manufacturing", observed: 2, target: 3, importance: 4 }), // gap1 * imp4 = 4
      input({ domain: "rd", observed: 1, target: 3, importance: 2 }), // gap2 * imp2 = 4
    ]);
    const ranked = rankCapabilityGaps(results);
    expect(ranked[0].domain).toBe("rd"); // same priority, larger gap wins
  });

  it("does not mutate the input array", () => {
    const results = computeCapabilityGaps([
      input({ domain: "manufacturing", importance: 1 }),
      input({ domain: "rd", importance: 5 }),
    ]);
    const original = [...results];
    rankCapabilityGaps(results);
    expect(results).toEqual(original);
  });
});

describe("validateCapabilityInputs", () => {
  it("accepts values within 1-5", () => {
    expect(validateCapabilityInputs([input({ observed: 1, target: 5, importance: 3 })])).toEqual([]);
  });

  it("rejects an observed level below 1", () => {
    const errors = validateCapabilityInputs([input({ observed: 0 })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("niveau observé");
  });

  it("rejects a target level above 5", () => {
    const errors = validateCapabilityInputs([input({ target: 6 })]);
    expect(errors.some((e) => e.includes("niveau cible"))).toBe(true);
  });

  it("rejects a non-integer importance", () => {
    const errors = validateCapabilityInputs([input({ importance: 2.5 })]);
    expect(errors.some((e) => e.includes("importance"))).toBe(true);
  });

  it("reports one error per invalid field, across multiple capabilities", () => {
    const errors = validateCapabilityInputs([
      input({ domain: "manufacturing", observed: 0, target: 6 }),
      input({ domain: "rd", importance: 0 }),
    ]);
    expect(errors).toHaveLength(3);
  });
});

describe("capabilityAssessmentProgress (gabarit D01)", () => {
  it("is empty while no capability has been assessed — defaults never count", () => {
    expect(capabilityAssessmentProgress([false, false, false])).toEqual({ state: "vide", assessed: 0, total: 3 });
  });

  it("is incomplete while only some capabilities are assessed", () => {
    expect(capabilityAssessmentProgress([true, false, false])).toEqual({ state: "incomplet", assessed: 1, total: 3 });
  });

  it("is complete once every capability is assessed", () => {
    expect(capabilityAssessmentProgress([true, true])).toEqual({ state: "complet", assessed: 2, total: 2 });
  });
});
