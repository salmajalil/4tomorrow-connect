import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("garde un chemin relatif au site", () => {
    expect(safeNextPath("/decide?transformationId=abc")).toBe("/decide?transformationId=abc");
    expect(safeNextPath("/auth/reset-password")).toBe("/auth/reset-password");
  });

  it("retombe sur la valeur par défaut si absent", () => {
    expect(safeNextPath(null)).toBe("/connect");
    expect(safeNextPath(undefined)).toBe("/connect");
    expect(safeNextPath("")).toBe("/connect");
  });

  it("refuse tout ce qui sortirait du site (open redirect)", () => {
    expect(safeNextPath("@evil.com")).toBe("/connect");
    expect(safeNextPath("//evil.com")).toBe("/connect");
    expect(safeNextPath("/\\evil.com")).toBe("/connect");
    expect(safeNextPath("https://evil.com")).toBe("/connect");
    expect(safeNextPath(".evil.com")).toBe("/connect");
  });
});
