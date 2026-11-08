import { describe, expect, it } from "vitest";
import { leadingNumber, riskCellTone } from "./deliver-content-display";

describe("leadingNumber", () => {
  it("extracts an integer", () => {
    expect(leadingNumber("92 %")).toBe(92);
  });

  it("extracts a decimal with a comma", () => {
    expect(leadingNumber("6,5 jours")).toBe(6.5);
  });

  it("extracts a decimal with a dot", () => {
    expect(leadingNumber("6.5 days")).toBe(6.5);
  });

  it("extracts a negative number", () => {
    expect(leadingNumber("-3 %")).toBe(-3);
  });

  it("returns null for non-numeric text", () => {
    expect(leadingNumber("comité mensuel")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(leadingNumber("")).toBeNull();
  });
});

describe("riskCellTone", () => {
  it("is good for low × low", () => {
    expect(riskCellTone("low", "low")).toBe("good");
  });

  it("is good for low × medium", () => {
    expect(riskCellTone("low", "medium")).toBe("good");
  });

  it("is warn for low × high", () => {
    expect(riskCellTone("low", "high")).toBe("warn");
  });

  it("is warn for medium × medium", () => {
    expect(riskCellTone("medium", "medium")).toBe("warn");
  });

  it("is crit for medium × high", () => {
    expect(riskCellTone("medium", "high")).toBe("crit");
  });

  it("is crit for high × high", () => {
    expect(riskCellTone("high", "high")).toBe("crit");
  });

  it("is symmetric in its two arguments", () => {
    expect(riskCellTone("medium", "high")).toBe(riskCellTone("high", "medium"));
  });
});
