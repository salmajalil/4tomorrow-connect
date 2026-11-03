import { describe, expect, it } from "vitest";
import { wrapLabel } from "./radar-chart";

describe("wrapLabel", () => {
  it("keeps a short label on one line", () => {
    expect(wrapLabel("Coût", 14)).toEqual(["Coût"]);
  });

  it("wraps a long label into multiple short lines instead of clipping", () => {
    const lines = wrapLabel("Retour sur investissement", 14);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(14 + 1); // allow one overflowing word on its own line
    }
    expect(lines.join(" ")).toBe("Retour sur investissement");
  });

  it("wraps the longest real axis label (CO2 fallback) without losing words", () => {
    const label = "CO2 / durabilité (ou équivalent)";
    const lines = wrapLabel(label, 14);
    expect(lines.join(" ")).toBe(label);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("puts an over-long single word on its own line rather than dropping it", () => {
    const lines = wrapLabel("Anticonstitutionnellement", 14);
    expect(lines).toEqual(["Anticonstitutionnellement"]);
  });

  it("returns an empty array for an empty label", () => {
    expect(wrapLabel("", 14)).toEqual([]);
  });
});
