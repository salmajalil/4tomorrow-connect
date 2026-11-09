import { describe, expect, it } from "vitest";
import {
  computePhaseDates,
  fitDurationsToWindow,
  ganttOffsetPercent,
  ganttRange,
  isIsoDate,
  monthTicks,
  parseMilestones,
  weeksBetween,
} from "./deliver-gantt-calc";

describe("isIsoDate / weeksBetween", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("15/03/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("counts whole weeks, rounding down, and refuses an end before the start", () => {
    expect(weeksBetween("2026-01-05", "2026-03-30")).toBe(12);
    expect(weeksBetween("2026-01-05", "2026-01-11")).toBe(0);
    expect(weeksBetween("2026-03-01", "2026-01-01")).toBeNull();
    expect(weeksBetween("bad", "2026-01-01")).toBeNull();
  });
});

describe("fitDurationsToWindow", () => {
  it("keeps the exact total, proportional to the proposed durations", () => {
    const fitted = fitDurationsToWindow([4, 8, 4], 32);
    expect(fitted).toEqual([8, 16, 8]);
    expect(fitted?.reduce((a, b) => a + b, 0)).toBe(32);
  });

  it("distributes rounding by largest remainder and never drops a phase below one week", () => {
    const fitted = fitDurationsToWindow([10, 1, 1], 5) as number[];
    expect(fitted.reduce((a, b) => a + b, 0)).toBe(5);
    expect(Math.min(...fitted)).toBeGreaterThanOrEqual(1);
    expect(fitted[0]).toBeGreaterThan(fitted[1]);
  });

  it("returns null when the window is shorter than one week per phase", () => {
    expect(fitDurationsToWindow([2, 2, 2], 2)).toBeNull();
    expect(fitDurationsToWindow([], 10)).toBeNull();
  });
});

describe("computePhaseDates", () => {
  it("chains phases end-to-start from the start date", () => {
    expect(computePhaseDates("2026-01-05", [2, 3])).toEqual([
      { start: "2026-01-05", end: "2026-01-19" },
      { start: "2026-01-19", end: "2026-02-09" },
    ]);
  });

  it("throws on an invalid start date instead of guessing one", () => {
    expect(() => computePhaseDates("demain", [2])).toThrow();
  });
});

describe("parseMilestones", () => {
  it("reads one milestone per line, ISO or French date, date optional", () => {
    expect(
      parseMilestones("- Go/No-go pilote — 2026-03-15\nMise en service : 01/06/2026\n\nAudit final")
    ).toEqual([
      { name: "Go/No-go pilote", date: "2026-03-15" },
      { name: "Mise en service", date: "2026-06-01" },
      { name: "Audit final", date: null },
    ]);
  });

  it("never invents a date from an impossible one", () => {
    expect(parseMilestones("Revue — 2026-02-30")).toEqual([{ name: "Revue", date: null }]);
    expect(parseMilestones("")).toEqual([]);
  });
});

describe("axis helpers", () => {
  it("places a date proportionally on the axis, null outside it", () => {
    expect(ganttOffsetPercent("2026-01-01", "2026-01-11", "2026-01-06")).toBe(50);
    expect(ganttOffsetPercent("2026-01-01", "2026-01-11", "2026-02-01")).toBeNull();
  });

  it("lists month starts strictly inside the range", () => {
    expect(monthTicks("2026-01-15", "2026-04-01")).toEqual(["2026-02-01", "2026-03-01"]);
    expect(monthTicks("2026-11-20", "2027-01-10")).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("extends the axis to the latest milestone or target date", () => {
    expect(ganttRange(["2026-01-05"], ["2026-03-01", "2026-06-30", null])).toEqual({ start: "2026-01-05", end: "2026-06-30" });
    expect(ganttRange([], ["2026-01-01"])).toBeNull();
  });
});
