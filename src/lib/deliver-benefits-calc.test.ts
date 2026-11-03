import { describe, expect, it } from "vitest";
import { compareBenefits, computeItemsTotal, computeObservedAnnual } from "./deliver-benefits-calc";

describe("computeItemsTotal", () => {
  it("sums distinct perimeters normally", () => {
    const result = computeItemsTotal([
      { label: "a", perimeter: "Approvisionnement", value: 10 },
      { label: "b", perimeter: "Fabrication", value: 20 },
    ]);
    expect(result.itemsTotal).toBe(30);
    expect(result.overlaps).toEqual([]);
  });

  it("never sums two gains on the same perimeter — takes the max instead", () => {
    const result = computeItemsTotal([
      { label: "a", perimeter: "Approvisionnement", value: 34 },
      { label: "b", perimeter: "Approvisionnement", value: 22 },
    ]);
    expect(result.itemsTotal).toBe(34); // NOT 56
    expect(result.overlaps).toEqual(["Approvisionnement"]);
  });

  it("handles three items on the same perimeter, keeping only the max", () => {
    const result = computeItemsTotal([
      { label: "a", perimeter: "P", value: 5 },
      { label: "b", perimeter: "P", value: 50 },
      { label: "c", perimeter: "P", value: 25 },
    ]);
    expect(result.itemsTotal).toBe(50);
    expect(result.totalByPerimeter).toEqual([{ perimeter: "P", value: 50, itemCount: 3 }]);
  });

  it("returns zero total for no items", () => {
    expect(computeItemsTotal([]).itemsTotal).toBe(0);
  });
});

describe("computeObservedAnnual", () => {
  it("returns null with no observations", () => {
    expect(computeObservedAnnual([])).toBeNull();
  });

  it("averages all months and multiplies by 12 when 12 or fewer exist", () => {
    const obs = [
      { month: "2026-01", value: 10 },
      { month: "2026-02", value: 10 },
    ];
    const result = computeObservedAnnual(obs);
    expect(result).toEqual({ observedAnnual: 120, monthsUsed: 2 });
  });

  it("uses only the last 12 months when more are given", () => {
    // 14 months total; the 2 oldest are huge outliers that must be dropped.
    const months = [
      { month: "2024-11", value: 1000 },
      { month: "2024-12", value: 1000 },
      ...Array.from({ length: 12 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, "0")}`, value: 10 })),
    ];
    const result = computeObservedAnnual(months);
    expect(result?.monthsUsed).toBe(12);
    expect(result?.observedAnnual).toBe(120); // avg(10)*12, outliers excluded
  });

  it("sorts observations by month before taking the trailing window (order-independent input)", () => {
    const shuffled = [
      { month: "2026-03", value: 30 },
      { month: "2026-01", value: 10 },
      { month: "2026-02", value: 20 },
    ];
    const result = computeObservedAnnual(shuffled);
    expect(result?.observedAnnual).toBe(240); // avg(10,20,30)=20 * 12
  });
});

describe("compareBenefits", () => {
  it("computes gap and percent when both figures are present", () => {
    const result = compareBenefits(100, 90);
    expect(result).toEqual({ expectedAnnual: 100, observedAnnual: 90, gap: -10, percentOfExpected: 90 });
  });

  it("returns null gap/percent when expected is absent (no D05, nothing entered yet)", () => {
    const result = compareBenefits(null, 90);
    expect(result.gap).toBeNull();
    expect(result.percentOfExpected).toBeNull();
  });

  it("returns null gap/percent when observed is absent (no measurements yet)", () => {
    const result = compareBenefits(100, null);
    expect(result.gap).toBeNull();
    expect(result.percentOfExpected).toBeNull();
  });

  it("avoids division by zero when expected is exactly 0", () => {
    const result = compareBenefits(0, 50);
    expect(result.percentOfExpected).toBeNull();
    expect(result.gap).toBe(50);
  });
});
