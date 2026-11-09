import { describe, expect, it } from "vitest";
import {
  BRICKS,
  MATCH_CATEGORIES,
  CONNECT_MATCH_CATEGORIES,
  brickOf,
  countByBrick,
  isCompetitorReference,
  splitCompetitorReferences,
} from "./ecosystem-bricks";

describe("BRICKS", () => {
  it("has exactly the three bricks decided by the founder, in order", () => {
    expect(BRICKS.map((b) => b.key)).toEqual(["strategy", "innovation", "suppliers"]);
  });

  it("files every recommendation category in exactly one brick", () => {
    for (const category of MATCH_CATEGORIES) {
      expect(BRICKS.filter((b) => (b.categories as string[]).includes(category))).toHaveLength(1);
    }
  });

  it("never files a competitor reference in a brick", () => {
    expect(BRICKS.some((b) => (b.categories as string[]).includes("competitor_reference"))).toBe(false);
  });
});

describe("brickOf", () => {
  it("maps generalist experts/partners (and funding, support) to Strategy", () => {
    expect(brickOf("expert")).toBe("strategy");
    expect(brickOf("partner")).toBe("strategy");
    expect(brickOf("funding")).toBe("strategy");
    expect(brickOf("support")).toBe("strategy");
  });

  it("maps technology and startups to Techno-Innovation", () => {
    expect(brickOf("technology")).toBe("innovation");
    expect(brickOf("startup")).toBe("innovation");
  });

  it("maps suppliers to Suppliers", () => {
    expect(brickOf("supplier")).toBe("suppliers");
  });

  it("falls back to Strategy for an unknown category", () => {
    expect(brickOf("something_else")).toBe("strategy");
  });

  it("returns null for a competitor reference", () => {
    expect(brickOf("competitor_reference")).toBeNull();
  });
});

describe("competitor references", () => {
  it("is part of the Connect categories only, not of the shared recommendation list", () => {
    expect(CONNECT_MATCH_CATEGORIES).toContain("competitor_reference");
    expect(MATCH_CATEGORIES as readonly string[]).not.toContain("competitor_reference");
    expect(isCompetitorReference("competitor_reference")).toBe(true);
    expect(isCompetitorReference("expert")).toBe(false);
  });

  it("splits matches without losing or reordering any", () => {
    const matches = [
      { name: "A", category: "expert" },
      { name: "B", category: "competitor_reference" },
      { name: "C", category: "supplier" },
      { name: "D", category: "competitor_reference" },
    ];
    const { recommendations, competitors } = splitCompetitorReferences(matches);
    expect(recommendations.map((m) => m.name)).toEqual(["A", "C"]);
    expect(competitors.map((m) => m.name)).toEqual(["B", "D"]);
  });

  it("are never counted in a brick", () => {
    const counts = countByBrick([
      { category: "expert" },
      { category: "technology" },
      { category: "startup" },
      { category: "supplier" },
      { category: "competitor_reference" },
    ]);
    expect(counts).toEqual({ strategy: 1, innovation: 2, suppliers: 1 });
  });

  it("counts every brick, at 0 when empty", () => {
    expect(countByBrick([])).toEqual({ strategy: 0, innovation: 0, suppliers: 0 });
  });
});
