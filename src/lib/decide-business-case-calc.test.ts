import { describe, it, expect } from "vitest";
import { computeBusinessCase, validateBusinessCaseInputs, type BusinessCaseInput } from "./decide-business-case-calc";

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
