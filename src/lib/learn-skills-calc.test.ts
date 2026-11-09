import { describe, expect, it } from "vitest";
import {
  computeSkillGaps,
  rankSkillGaps,
  validateSkillInputs,
  suggestTrainingForGap,
  topGapPerDomain,
  buildTrainingSuggestions,
  DEFAULT_TRAINING_SUGGESTIONS,
  type SkillAssessmentInput,
} from "./learn-skills-calc";

function input(overrides: Partial<SkillAssessmentInput> = {}): SkillAssessmentInput {
  return {
    role: "Chef de ligne",
    domain: "manufacturing",
    required: 3,
    demonstrated: 1,
    criticality: 3,
    selfAssessed: false,
    ...overrides,
  };
}

describe("computeSkillGaps", () => {
  it("computes gap = required - demonstrated", () => {
    const [result] = computeSkillGaps([input({ required: 3, demonstrated: 1 })]);
    expect(result.gap).toBe(2);
  });

  it("computes weighted = gap * criticality", () => {
    const [result] = computeSkillGaps([input({ required: 3, demonstrated: 1, criticality: 4 })]);
    expect(result.weighted).toBe(8); // gap(2) * criticality(4)
  });

  it("clamps gap to 0 when demonstrated exceeds required (never negative)", () => {
    const [result] = computeSkillGaps([input({ required: 1, demonstrated: 4 })]);
    expect(result.gap).toBe(0);
    expect(result.weighted).toBe(0);
  });

  it("returns gap 0 when demonstrated equals required", () => {
    const [result] = computeSkillGaps([input({ required: 2, demonstrated: 2 })]);
    expect(result.gap).toBe(0);
  });

  it("marks a self-assessed cell as à confirmer, regardless of the gap", () => {
    const [result] = computeSkillGaps([input({ selfAssessed: true, required: 3, demonstrated: 3 })]);
    expect(result.status).toBe("à confirmer");
  });

  it("marks a non-self-assessed cell as confirmé", () => {
    const [result] = computeSkillGaps([input({ selfAssessed: false })]);
    expect(result.status).toBe("confirmé");
  });

  it("trims the stored role name", () => {
    const [result] = computeSkillGaps([input({ role: "  Chef de ligne  " })]);
    expect(result.role).toBe("Chef de ligne");
  });
});

describe("rankSkillGaps", () => {
  it("sorts by weighted priority descending", () => {
    const results = computeSkillGaps([
      input({ role: "A", required: 2, demonstrated: 1, criticality: 2 }), // weighted 2
      input({ role: "B", required: 4, demonstrated: 0, criticality: 3 }), // weighted 12
      input({ role: "C", required: 3, demonstrated: 1, criticality: 2 }), // weighted 4
    ]);
    const ranked = rankSkillGaps(results);
    expect(ranked.map((r) => r.role)).toEqual(["B", "C", "A"]);
  });

  it("breaks weighted ties by raw gap, then role, then domain — deterministic, no randomness", () => {
    const results = computeSkillGaps([
      input({ role: "Z", domain: "strategy", required: 4, demonstrated: 2, criticality: 2 }), // gap 2, weighted 4
      input({ role: "A", domain: "rd", required: 4, demonstrated: 2, criticality: 2 }), // gap 2, weighted 4
    ]);
    const ranked = rankSkillGaps(results);
    expect(ranked.map((r) => r.role)).toEqual(["A", "Z"]);
  });

  it("does not mutate the input array", () => {
    const results = computeSkillGaps([input({ role: "A" }), input({ role: "B", criticality: 5 })]);
    const copy = [...results];
    rankSkillGaps(results);
    expect(results).toEqual(copy);
  });
});

describe("validateSkillInputs", () => {
  it("accepts in-range, named inputs", () => {
    expect(validateSkillInputs([input()])).toEqual([]);
  });

  it("rejects a required level outside 0-4", () => {
    const errors = validateSkillInputs([input({ required: 5 })]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a demonstrated level outside 0-4", () => {
    const errors = validateSkillInputs([input({ demonstrated: -1 })]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a criticality outside 1-5", () => {
    const errors = validateSkillInputs([input({ criticality: 0 })]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a blank role name", () => {
    const errors = validateSkillInputs([input({ role: "   " })]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("suggestTrainingForGap", () => {
  it("falls back to the default catalog when nothing is overridden", () => {
    expect(suggestTrainingForGap("manufacturing", {})).toBe(DEFAULT_TRAINING_SUGGESTIONS.manufacturing);
  });

  it("prefers an organization's own catalog entry over the default", () => {
    expect(suggestTrainingForGap("manufacturing", { manufacturing: "Atelier interne sur-mesure" })).toBe(
      "Atelier interne sur-mesure"
    );
  });
});

describe("topGapPerDomain", () => {
  it("never returns two gaps for the same domain", () => {
    const results = computeSkillGaps([
      input({ role: "A", domain: "manufacturing", required: 3, demonstrated: 0, criticality: 2 }),
      input({ role: "B", domain: "manufacturing", required: 2, demonstrated: 0, criticality: 1 }),
      input({ role: "C", domain: "rd", required: 2, demonstrated: 1, criticality: 2 }),
    ]);
    const top = topGapPerDomain(results);
    const domains = top.map((r) => r.domain);
    expect(new Set(domains).size).toBe(domains.length);
    expect(domains.sort()).toEqual(["manufacturing", "rd"]);
  });

  it("picks the highest-weighted gap within a domain", () => {
    const results = computeSkillGaps([
      input({ role: "Low", domain: "manufacturing", required: 2, demonstrated: 1, criticality: 1 }), // weighted 1
      input({ role: "High", domain: "manufacturing", required: 4, demonstrated: 0, criticality: 3 }), // weighted 12
    ]);
    const top = topGapPerDomain(results);
    expect(top).toHaveLength(1);
    expect(top[0].role).toBe("High");
  });

  it("excludes cells with no gap", () => {
    const results = computeSkillGaps([input({ required: 2, demonstrated: 2 })]);
    expect(topGapPerDomain(results)).toHaveLength(0);
  });
});

describe("buildTrainingSuggestions", () => {
  const results = computeSkillGaps([
    input({ role: "Chef de ligne", domain: "manufacturing", required: 4, demonstrated: 1, criticality: 5 }), // écart 3, pondéré 15
    input({ role: "Opérateur", domain: "manufacturing", required: 3, demonstrated: 2, criticality: 2 }), // écart 1, pondéré 2
    input({ role: "Data analyst", domain: "digitalization", required: 4, demonstrated: 2, criticality: 4 }), // écart 2, pondéré 8
    input({ role: "Directeur", domain: "strategy", required: 2, demonstrated: 3, criticality: 5 }), // pas d'écart
  ]);

  it("propose une formation par domaine en écart, jamais pour un domaine sans écart", () => {
    const suggestions = buildTrainingSuggestions(results, {});
    expect(suggestions.map((s) => s.domain)).toEqual(["manufacturing", "digitalization"]);
  });

  it("dérive l'impact visé des niveaux saisis : écart du rôle prioritaire, rôles et niveaux cumulés du domaine", () => {
    const [manufacturing, digital] = buildTrainingSuggestions(results, {});
    expect(manufacturing.topGap.role).toBe("Chef de ligne");
    expect(manufacturing.levelsTargeted).toBe(3);
    expect(manufacturing.rolesAffected).toBe(2);
    expect(manufacturing.totalGapLevels).toBe(4);
    expect(manufacturing.totalWeighted).toBe(17);
    expect(digital.levelsTargeted).toBe(2);
    expect(digital.rolesAffected).toBe(1);
  });

  it("prend l'intitulé du catalogue éditable, sinon le catalogue par défaut", () => {
    const [manufacturing, digital] = buildTrainingSuggestions(results, { manufacturing: "SMED en atelier" });
    expect(manufacturing.suggestion).toBe("SMED en atelier");
    expect(digital.suggestion).toBe(DEFAULT_TRAINING_SUGGESTIONS.digitalization);
  });

  it("classe par priorité pondérée cumulée décroissante", () => {
    const flipped = computeSkillGaps([
      input({ role: "A", domain: "manufacturing", required: 1, demonstrated: 0, criticality: 1 }), // 1
      input({ role: "B", domain: "gtm", required: 4, demonstrated: 0, criticality: 5 }), // 20
    ]);
    expect(buildTrainingSuggestions(flipped, {}).map((s) => s.domain)).toEqual(["gtm", "manufacturing"]);
  });

  it("renvoie une liste vide sans aucun écart", () => {
    expect(buildTrainingSuggestions(computeSkillGaps([input({ required: 1, demonstrated: 2 })]), {})).toEqual([]);
  });
});
