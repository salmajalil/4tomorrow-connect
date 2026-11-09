import { describe, expect, it } from "vitest";
import {
  compareBenefits,
  compareToTrajectory,
  computeExpectedTrajectory,
  computeItemsTotal,
  computeObservedAnnual,
  resolveTrajectoryWindow,
} from "./deliver-benefits-calc";

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

describe("computeExpectedTrajectory", () => {
  it("interpolates linearly: at 60% of the elapsed time, 60% of the baseline→target delta", () => {
    const r = computeExpectedTrajectory({ startDate: "2026-01-01", targetDate: "2026-04-11", today: "2026-03-02", baseline: 0, target: 1000 });
    expect(r).toEqual({ elapsedRatio: 0.6, expectedToDate: 600 });
  });

  it("starts from a non-zero baseline", () => {
    const r = computeExpectedTrajectory({ startDate: "2026-01-01", targetDate: "2026-04-11", today: "2026-02-20", baseline: 200, target: 1200 });
    expect(r?.expectedToDate).toBe(700);
  });

  it("clamps before the start and after the target date", () => {
    expect(
      computeExpectedTrajectory({ startDate: "2026-01-01", targetDate: "2026-04-11", today: "2025-12-01", baseline: 0, target: 1000 })
    ).toEqual({ elapsedRatio: 0, expectedToDate: 0 });
    expect(
      computeExpectedTrajectory({ startDate: "2026-01-01", targetDate: "2026-04-11", today: "2027-01-01", baseline: 0, target: 1000 })
    ).toEqual({ elapsedRatio: 1, expectedToDate: 1000 });
  });

  it("computes nothing when the start, the target date or the target value is unknown", () => {
    const base = { startDate: "2026-01-01", targetDate: "2026-04-11", today: "2026-03-02", baseline: 0, target: 1000 };
    expect(computeExpectedTrajectory({ ...base, startDate: null })).toBeNull();
    expect(computeExpectedTrajectory({ ...base, targetDate: null })).toBeNull();
    expect(computeExpectedTrajectory({ ...base, target: null })).toBeNull();
    expect(computeExpectedTrajectory({ ...base, targetDate: "2025-12-01" })).toBeNull();
  });
});

describe("compareToTrajectory", () => {
  it("reports the gap in value and in % of the expected trajectory", () => {
    expect(compareToTrajectory(480, 600)).toEqual({ realized: 480, expectedToDate: 600, gap: -120, gapPercent: -20, status: "behind" });
    expect(compareToTrajectory(660, 600).status).toBe("ahead");
    expect(compareToTrajectory(590, 600).status).toBe("on_track");
  });

  it("has no % gap when nothing was expected yet", () => {
    expect(compareToTrajectory(50, 0)).toMatchObject({ gapPercent: null, status: "ahead" });
  });
});

describe("resolveTrajectoryWindow", () => {
  const phases = [
    { start_date: "2026-03-01", end_date: "2026-06-01", actual_start_date: null, order_index: 1 },
    { start_date: "2026-01-05", end_date: "2026-03-01", actual_start_date: "2026-01-12", order_index: 0 },
  ];

  it("uses the first phase's actual start and the latest planned end", () => {
    expect(resolveTrajectoryWindow(phases, [])).toEqual({ startDate: "2026-01-12", targetDate: "2026-06-01" });
  });

  it("falls back to the first observation for the start, and has no target without a roadmap", () => {
    expect(resolveTrajectoryWindow([], [{ month: "2026-04", value: 1 }, { month: "2026-02", value: 1 }])).toEqual({
      startDate: "2026-02-01",
      targetDate: null,
    });
  });
});
