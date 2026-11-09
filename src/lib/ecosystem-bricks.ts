import type { IconName } from "@/components/icons";

// Every category a real recommendation can carry. The first five are the
// original ones (kept so stored results still render); "supplier" and
// "support" came with the former five-brick view. Shared with Décider
// (src/lib/decide.ts, scenario suppliers), which must never produce a
// competitor reference — hence the separate list below.
export const MATCH_CATEGORIES = ["technology", "startup", "expert", "partner", "funding", "supplier", "support"] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];

// Connecter only: a real player whose business is the same as 4 Tomorrow's
// (strategic / industrial transformation consulting, integrators selling the
// same mission). Kept for the firm's internal market watch, NEVER counted in
// a brick nor mixed into the recommendations (see splitCompetitorReferences).
export const COMPETITOR_REFERENCE = "competitor_reference" as const;
export const CONNECT_MATCH_CATEGORIES = [...MATCH_CATEGORIES, COMPETITOR_REFERENCE] as const;
export type ConnectMatchCategory = (typeof CONNECT_MATCH_CATEGORIES)[number];

// The three bricks of a transformation ecosystem, as presented to the client
// (founder's decision, replaces the former five bricks).
//
// Category -> brick mapping:
//   strategy    ("Stratégie", global / cross-cutting view of the project's
//                poles): "expert" and "partner" (generalist or multi-domain
//                players), plus "funding" and "support" — grant programmes,
//                clusters, regional agencies and technical centres serve the
//                whole project rather than one technical pole, so they belong
//                to the cross-cutting brick.
//   innovation  ("Techno-Innovation"): "technology" and "startup".
//   suppliers   ("Fournisseurs", supply chain): "supplier".
//   (none)      "competitor_reference" — internal market watch only.
//
// Since this view, the matching prompt (src/lib/matching.ts) asks the model
// to file technical/integration partners under "technology" so that
// "partner" means a generalist partner. Results stored before that change
// may still have a technical integrator under "partner": it now shows up in
// Stratégie.
export type BrickKey = "strategy" | "innovation" | "suppliers";

export const BRICKS: { key: BrickKey; icon: IconName; categories: MatchCategory[] }[] = [
  { key: "strategy", icon: "spark", categories: ["expert", "partner", "funding", "support"] },
  { key: "innovation", icon: "plug", categories: ["technology", "startup"] },
  { key: "suppliers", icon: "truck", categories: ["supplier"] },
];

export function isCompetitorReference(category: string): boolean {
  return category === COMPETITOR_REFERENCE;
}

/**
 * The brick a category belongs to. An unknown category (an older or
 * unexpected value) falls back to Stratégie, the cross-cutting brick; a
 * competitor reference belongs to no brick and returns null.
 */
export function brickOf(category: string): BrickKey | null {
  if (isCompetitorReference(category)) return null;
  return BRICKS.find((b) => (b.categories as string[]).includes(category))?.key ?? "strategy";
}

/** Splits matches into real recommendations and competitor references, keeping each list's order. */
export function splitCompetitorReferences<T extends { category: string }>(
  matches: T[]
): { recommendations: T[]; competitors: T[] } {
  const recommendations: T[] = [];
  const competitors: T[] = [];
  for (const m of matches) (isCompetitorReference(m.category) ? competitors : recommendations).push(m);
  return { recommendations, competitors };
}

/** Number of recommendations per brick (every brick present, 0 when empty). Competitor references are never counted. */
export function countByBrick(matches: { category: string }[]): Record<BrickKey, number> {
  const counts = Object.fromEntries(BRICKS.map((b) => [b.key, 0])) as Record<BrickKey, number>;
  for (const m of matches) {
    const brick = brickOf(m.category);
    if (brick) counts[brick] += 1;
  }
  return counts;
}
