import { describe, it, expect } from "vitest";
import {
  businessCaseFormValuesFromInput,
  businessCaseInputsSignature,
  computeBusinessCase,
  invalidBusinessCaseFields,
  readBusinessCaseForm,
  validateBusinessCaseInputs,
  type BusinessCaseInput,
} from "./decide-business-case-calc";

const base: BusinessCaseInput = {
  capex: 120,
  annualGains: 100,
  annualCosts: 20,
  horizonYears: 3,
  discountRatePercent: null,
};

describe("validateBusinessCaseInputs", () => {
  it("accepts a well-formed input", () => {
    expect(validateBusinessCaseInputs(base)).toEqual([]);
  });

  it("rejects a non-positive investment", () => {
    expect(validateBusinessCaseInputs({ ...base, capex: 0 })).toContain(
      "L'investissement initial doit être un montant positif."
    );
  });

  it("rejects a negative annual gain", () => {
    expect(validateBusinessCaseInputs({ ...base, annualGains: -1 })).toContain(
      "Les gains bruts annuels doivent être un montant positif ou nul."
    );
  });

  it("rejects a horizon outside 1-15", () => {
    expect(validateBusinessCaseInputs({ ...base, horizonYears: 0 }).length).toBeGreaterThan(0);
    expect(validateBusinessCaseInputs({ ...base, horizonYears: 16 }).length).toBeGreaterThan(0);
    expect(validateBusinessCaseInputs({ ...base, horizonYears: 2.5 }).length).toBeGreaterThan(0);
  });

  it("rejects a discount rate outside 0-50 but allows null", () => {
    expect(validateBusinessCaseInputs({ ...base, discountRatePercent: -1 }).length).toBeGreaterThan(0);
    expect(validateBusinessCaseInputs({ ...base, discountRatePercent: 51 }).length).toBeGreaterThan(0);
    expect(validateBusinessCaseInputs({ ...base, discountRatePercent: null })).toEqual([]);
  });
});

describe("computeBusinessCase", () => {
  it("computes a simple non-discounted payback", () => {
    const result = computeBusinessCase(base);
    expect(result.netAnnual).toBe(80);
    expect(result.paybackYears).toBe(1.5); // 120 / 80
  });

  it("never computes an NPV when no discount rate is given", () => {
    const result = computeBusinessCase(base);
    expect(result.npv).toBeNull();
  });

  it("computes an NPV only when a discount rate is explicitly provided", () => {
    const result = computeBusinessCase({ ...base, discountRatePercent: 10 });
    expect(result.npv).not.toBeNull();
    // -120 + 80/1.1 + 80/1.1^2 + 80/1.1^3 ≈ 78.95
    expect(result.npv).toBeCloseTo(78.95, 1);
  });

  it("never invents a rate of 0 as a substitute for null", () => {
    const withZeroRate = computeBusinessCase({ ...base, discountRatePercent: 0 });
    const withNoRate = computeBusinessCase({ ...base, discountRatePercent: null });
    expect(withZeroRate.npv).not.toBeNull();
    expect(withNoRate.npv).toBeNull();
    // a 0% rate is a real user choice (no discounting) and differs from "no NPV at all"
    expect(withZeroRate.npv).toBe(withZeroRate.cumulativeByYear.at(-1));
  });

  it("returns a null payback when the net annual flow is not positive", () => {
    const neverProfitable = computeBusinessCase({ ...base, annualGains: 10, annualCosts: 20 });
    expect(neverProfitable.netAnnual).toBe(-10);
    expect(neverProfitable.paybackYears).toBeNull();
  });

  it("builds a cumulative series starting at -capex with horizonYears+1 points", () => {
    const result = computeBusinessCase(base);
    expect(result.cumulativeByYear).toHaveLength(base.horizonYears + 1);
    expect(result.cumulativeByYear[0]).toBe(-120);
    expect(result.cumulativeByYear.at(-1)).toBe(-120 + 80 * 3);
  });
});

describe("readBusinessCaseForm (gabarit D05)", () => {
  const filled = { capex: "120", annualGains: "100", annualCosts: "20", horizonYears: "3", discountRatePercent: "" };

  it("is empty before any input (horizon default alone does not count)", () => {
    const r = readBusinessCaseForm({ capex: "", annualGains: "", annualCosts: "", horizonYears: "3", discountRatePercent: "" });
    expect(r.status).toBe("vide");
    expect(r.input).toBeNull();
  });

  it("is incomplete when a required field is left blank — never treated as zero", () => {
    const r = readBusinessCaseForm({ ...filled, annualCosts: "" });
    expect(r.status).toBe("incomplet");
    expect(r.missing).toEqual(["annualCosts"]);
    expect(r.input).toBeNull();
  });

  it("accepts an explicit zero as a real value", () => {
    const r = readBusinessCaseForm({ ...filled, annualCosts: "0" });
    expect(r.status).toBe("pret");
    expect(r.input).toEqual({ capex: 120, annualGains: 100, annualCosts: 0, horizonYears: 3, discountRatePercent: null });
  });

  it("reports calcul impossible for out-of-range values, by field", () => {
    const r = readBusinessCaseForm({ ...filled, capex: "0", horizonYears: "20" });
    expect(r.status).toBe("calcul_impossible");
    expect(r.invalid).toEqual(["capex", "horizonYears"]);
  });

  it("reports calcul impossible for a non-numeric value", () => {
    const r = readBusinessCaseForm({ ...filled, discountRatePercent: "abc" });
    expect(r.status).toBe("calcul_impossible");
    expect(r.invalid).toEqual(["discountRatePercent"]);
  });

  it("accepts a decimal comma", () => {
    const r = readBusinessCaseForm({ ...filled, discountRatePercent: "4,5" });
    expect(r.input?.discountRatePercent).toBe(4.5);
  });
});

describe("invalidBusinessCaseFields", () => {
  it("lists nothing for a valid input", () => {
    expect(invalidBusinessCaseFields(base)).toEqual([]);
  });
  it("flags an out-of-range discount rate", () => {
    expect(invalidBusinessCaseFields({ ...base, discountRatePercent: 60 })).toEqual(["discountRatePercent"]);
  });
});

describe("businessCaseInputsSignature (« à revoir »)", () => {
  it("is identical for identical inputs", () => {
    expect(businessCaseInputsSignature(base)).toBe(businessCaseInputsSignature({ ...base }));
  });
  it("changes when any input changes", () => {
    expect(businessCaseInputsSignature(base)).not.toBe(businessCaseInputsSignature({ ...base, annualCosts: 21 }));
    expect(businessCaseInputsSignature(base)).not.toBe(businessCaseInputsSignature({ ...base, discountRatePercent: 5 }));
  });
  it("round-trips through the form values rebuilt from a saved case", () => {
    const values = businessCaseFormValuesFromInput({ ...base, discountRatePercent: 5 });
    const r = readBusinessCaseForm(values);
    expect(r.input && businessCaseInputsSignature(r.input)).toBe(businessCaseInputsSignature({ ...base, discountRatePercent: 5 }));
  });
});
