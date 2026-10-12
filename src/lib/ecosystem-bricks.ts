import type { IconName } from "@/components/icons";

// Every match category the matching engine can return. The first five are
// the original ones (kept so stored results still render); "supplier" and
// "support" were added for the five-brick ecosystem view.
export const MATCH_CATEGORIES = ["technology", "startup", "expert", "partner", "funding", "supplier", "support"] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];

// The five bricks of a transformation ecosystem, as presented to the client.
// Technology providers and startups are technical partners from the
// client's point of view, so they share the first brick.
export type BrickKey = "partners" | "suppliers" | "funding" | "support" | "experts";

export const BRICKS: { key: BrickKey; icon: IconName; categories: MatchCategory[] }[] = [
  { key: "partners", icon: "plug", categories: ["partner", "technology", "startup"] },
  { key: "suppliers", icon: "truck", categories: ["supplier"] },
  { key: "funding", icon: "trend", categories: ["funding"] },
  { key: "support", icon: "building", categories: ["support"] },
  { key: "experts", icon: "spark", categories: ["expert"] },
];

export function brickOf(category: string): BrickKey {
  return BRICKS.find((b) => (b.categories as string[]).includes(category))?.key ?? "partners";
}
