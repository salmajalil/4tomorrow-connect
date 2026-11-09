import { describe, expect, it } from "vitest";
import { AI_QUOTA_WINDOW_MS, aiQuotaWindowStart, isAiQuotaExceeded } from "./ai-quota-calc";

describe("isAiQuotaExceeded", () => {
  it("allows calls below the maximum", () => {
    expect(isAiQuotaExceeded(0, 30)).toBe(false);
    expect(isAiQuotaExceeded(29, 30)).toBe(false);
  });

  it("blocks once the count reaches the maximum", () => {
    expect(isAiQuotaExceeded(30, 30)).toBe(true);
    expect(isAiQuotaExceeded(31, 30)).toBe(true);
  });

  it("blocks everything when the maximum is 0", () => {
    expect(isAiQuotaExceeded(0, 0)).toBe(true);
  });

  it("fails closed on an invalid maximum", () => {
    expect(isAiQuotaExceeded(0, -1)).toBe(true);
    expect(isAiQuotaExceeded(0, Number.NaN)).toBe(true);
  });

  it("treats a missing/invalid count as zero", () => {
    expect(isAiQuotaExceeded(Number.NaN, 30)).toBe(false);
    expect(isAiQuotaExceeded(-5, 30)).toBe(false);
  });
});

describe("aiQuotaWindowStart", () => {
  it("returns the instant exactly 24 hours earlier, as ISO", () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    expect(aiQuotaWindowStart(now)).toBe("2026-11-07T12:00:00.000Z");
    expect(now.getTime() - new Date(aiQuotaWindowStart(now)).getTime()).toBe(AI_QUOTA_WINDOW_MS);
  });
});
