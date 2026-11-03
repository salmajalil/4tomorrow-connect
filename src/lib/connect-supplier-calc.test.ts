import { describe, expect, it } from "vitest";
import {
  computeSupplierAssessment,
  validateSupplierInputs,
  type SupplierCriterion,
  type SupplierPrerequisite,
} from "./connect-supplier-calc";

const okPrereqs: SupplierPrerequisite[] = [
  { label: "ISO 9001", met: true },
  { label: "Zone < 500 km", met: true },
];

const verifiedCriterion = (label: string, score: number): SupplierCriterion => ({
  label,
  score,
  proofStatus: "vérifié",
  proofDate: "2026-01-15",
});

describe("computeSupplierAssessment", () => {
  it("is eligible and recommended when all prerequisites are met and all criteria are verified", () => {
    const criteria = [verifiedCriterion("Capacité", 4), verifiedCriterion("Qualité", 5)];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.eligible).toBe(true);
    expect(result.failedPrerequisites).toEqual([]);
    expect(result.score).toBe(4.5);
    expect(result.missingProofs).toEqual([]);
    expect(result.recommended).toBe(true);
  });

  it("is ineligible, and never recommended, when a single prerequisite fails — even with perfect verified criteria", () => {
    const prereqs: SupplierPrerequisite[] = [
      { label: "ISO 9001", met: false },
      { label: "Zone < 500 km", met: true },
    ];
    const criteria = [verifiedCriterion("Capacité", 5), verifiedCriterion("Qualité", 5)];
    const result = computeSupplierAssessment(prereqs, criteria);
    expect(result.eligible).toBe(false);
    expect(result.failedPrerequisites).toEqual(["ISO 9001"]);
    expect(result.recommended).toBe(false);
  });

  it("only counts criteria with proofStatus 'vérifié' in the score — 'manquant' and 'périmé' are excluded", () => {
    const criteria: SupplierCriterion[] = [
      verifiedCriterion("Capacité", 2),
      { label: "Qualité", score: 5, proofStatus: "manquant", proofDate: null },
      { label: "Délai", score: 5, proofStatus: "périmé", proofDate: "2020-01-01" },
    ];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.score).toBe(2);
    expect(result.verifiedCount).toBe(1);
    expect(result.totalCriteria).toBe(3);
  });

  it("is never 'recommandé' when any proof is missing or expired, even if eligible", () => {
    const criteria: SupplierCriterion[] = [
      verifiedCriterion("Capacité", 5),
      { label: "Qualité", score: null, proofStatus: "manquant", proofDate: null },
    ];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.eligible).toBe(true);
    expect(result.recommended).toBe(false);
    expect(result.missingProofs.map((c) => c.label)).toEqual(["Qualité"]);
  });

  it("lists every non-'vérifié' criterion as a missing proof — one action per missing piece", () => {
    const criteria: SupplierCriterion[] = [
      { label: "A", score: null, proofStatus: "manquant", proofDate: null },
      { label: "B", score: 3, proofStatus: "périmé", proofDate: "2019-01-01" },
      verifiedCriterion("C", 4),
    ];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.missingProofs).toHaveLength(2);
    expect(result.missingProofs.map((c) => c.label).sort()).toEqual(["A", "B"]);
  });

  it("returns a null score, and is never recommended, when no criterion is verified yet", () => {
    const criteria: SupplierCriterion[] = [{ label: "Capacité", score: null, proofStatus: "manquant", proofDate: null }];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.score).toBeNull();
    expect(result.recommended).toBe(false);
  });

  it("is not recommended when there are no criteria at all, even if eligible", () => {
    const result = computeSupplierAssessment(okPrereqs, []);
    expect(result.eligible).toBe(true);
    expect(result.recommended).toBe(false);
  });

  it("rounds the average score to 2 decimals", () => {
    const criteria = [verifiedCriterion("A", 3), verifiedCriterion("B", 4), verifiedCriterion("C", 4)];
    const result = computeSupplierAssessment(okPrereqs, criteria);
    expect(result.score).toBeCloseTo(3.67, 2);
  });
});

describe("validateSupplierInputs", () => {
  it("accepts well-formed prerequisites and criteria", () => {
    expect(validateSupplierInputs(okPrereqs, [verifiedCriterion("Capacité", 4)])).toEqual([]);
  });

  it("rejects a 'vérifié' criterion without a score", () => {
    const errors = validateSupplierInputs(okPrereqs, [
      { label: "Capacité", score: null, proofStatus: "vérifié", proofDate: "2026-01-01" },
    ]);
    expect(errors.some((e) => e.includes("Capacité"))).toBe(true);
  });

  it("rejects a 'vérifié' criterion without a proof date", () => {
    const errors = validateSupplierInputs(okPrereqs, [
      { label: "Capacité", score: 4, proofStatus: "vérifié", proofDate: null },
    ]);
    expect(errors.some((e) => e.includes("date"))).toBe(true);
  });

  it("rejects an unlabeled prerequisite or criterion", () => {
    expect(validateSupplierInputs([{ label: "  ", met: true }], [])).toHaveLength(1);
    expect(validateSupplierInputs([], [{ label: "", score: 3, proofStatus: "manquant", proofDate: null }])).toHaveLength(1);
  });

  it("does not require a score or date for a 'manquant' or 'périmé' criterion", () => {
    const errors = validateSupplierInputs(okPrereqs, [
      { label: "Capacité", score: null, proofStatus: "manquant", proofDate: null },
    ]);
    expect(errors).toEqual([]);
  });
});
