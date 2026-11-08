import { describe, expect, it } from "vitest";
import { isHttpUrl, sanitizeUrl } from "./url-safety";

describe("sanitizeUrl", () => {
  it("keeps http(s) URLs", () => {
    expect(sanitizeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("adds https to a bare domain", () => {
    expect(sanitizeUrl("example.com")).toBe("https://example.com/");
  });

  it("never returns a dangerous scheme", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>x</script>", "vbscript:msgbox(1)"]) {
      const out = sanitizeUrl(bad);
      expect(out === undefined || /^https?:\/\//.test(out)).toBe(true);
    }
  });

  it("returns undefined for empty input", () => {
    expect(sanitizeUrl(null)).toBeUndefined();
    expect(sanitizeUrl("  ")).toBeUndefined();
  });
});

describe("isHttpUrl", () => {
  it("accepts explicit http(s) URLs only", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});
