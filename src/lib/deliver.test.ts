import { describe, expect, it } from "vitest";
import {
  DELIVERABLE_KINDS,
  MAX_KPI_INDICATOR_QUESTIONS,
  buildDeliverableSystemPrompt,
  buildDeliverableUserPrompt,
  buildInputsBlock,
  buildMeasuredDataLines,
  getDeliverableInputFields,
  parseDeliverableOutput,
  type DeliverGenerationContext,
} from "./deliver";

const baseContext: DeliverGenerationContext = {
  domains: [],
  organization: "Acme",
  industry: "Manufacturing",
  challenges: "",
  objectives: "",
  trajectoryName: "Trajectoire A",
  trajectoryStance: "offensive",
  trajectoryDescription: "",
  executiveBriefing: "",
  techStack: [],
  indicators: {},
  gaps: [],
  priorities: [],
};

describe("getDeliverableInputFields", () => {
  it("returns a few optional fields for every deliverable kind, in both languages", () => {
    for (const kind of DELIVERABLE_KINDS) {
      const fr = getDeliverableInputFields(kind, "fr");
      const en = getDeliverableInputFields(kind, "en");
      expect(fr.length).toBeGreaterThanOrEqual(2);
      expect(fr.length).toBeLessThanOrEqual(6);
      expect(fr.map((f) => f.key)).toEqual(en.map((f) => f.key));
      for (const field of fr) {
        expect(field.label.length).toBeGreaterThan(0);
        expect(field.placeholder.length).toBeGreaterThan(0);
      }
      // Labels/placeholders actually differ per language, not a copy-paste.
      expect(fr[0].label).not.toBe(en[0].label);
    }
  });
});

describe("buildDeliverableUserPrompt", () => {
  it("omits the inputs block entirely when no kind/inputs are given (recalibration & roadmap-adjust callers)", () => {
    const prompt = buildDeliverableUserPrompt(baseContext);
    expect(prompt).not.toContain("Real-world inputs provided by the client");
  });

  it("omits the inputs block when every answer is blank — the fast Boost All path stays untouched", () => {
    const prompt = buildDeliverableUserPrompt(baseContext, "risk_map", { knownRisks: "   ", riskAppetite: "" });
    expect(prompt).not.toContain("Real-world inputs provided by the client");
  });

  it("includes only the filled fields for the given kind, under their invariant prompt label", () => {
    const prompt = buildDeliverableUserPrompt(baseContext, "kpi_dashboard", {
      currentBaseline: "Taux de service actuel : 92%",
      reportingFrequency: "",
    });
    expect(prompt).toContain("Real-world inputs provided by the client");
    expect(prompt).toContain("Real current measured values for the indicators");
    expect(prompt).toContain("Taux de service actuel : 92%");
    expect(prompt).not.toContain("How often these KPIs will actually be tracked");
  });

  it("caps each answer's length defensively instead of rejecting it", () => {
    const long = "y".repeat(2000);
    const prompt = buildDeliverableUserPrompt(baseContext, "toolkit", { existingTools: long });
    expect(prompt).toContain("y".repeat(600));
    expect(prompt).not.toContain("y".repeat(601));
  });
});

describe("KPI dashboard questionnaire — per indicator", () => {
  it("asks a baseline and an owner for each indicator already identified, instead of one generic box", () => {
    const fields = getDeliverableInputFields("kpi_dashboard", "fr", { indicatorNames: ["Taux de service", "Délai moyen"] });
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("baseline:Taux de service");
    expect(keys).toContain("owner:Taux de service");
    expect(keys).toContain("baseline:Délai moyen");
    expect(keys).toContain("reportingFrequency");
    expect(keys).not.toContain("currentBaseline");
    expect(fields.find((f) => f.key === "baseline:Délai moyen")?.label).toContain("Délai moyen");
  });

  it("falls back to the generic baseline question when no indicator exists, and caps the indicator count", () => {
    expect(getDeliverableInputFields("kpi_dashboard", "en").map((f) => f.key)).toContain("currentBaseline");
    const many = Array.from({ length: 10 }, (_, i) => `KPI ${i}`);
    const fields = getDeliverableInputFields("kpi_dashboard", "en", { indicatorNames: many });
    expect(fields.filter((f) => f.key.startsWith("baseline:"))).toHaveLength(MAX_KPI_INDICATOR_QUESTIONS);
  });

  it("puts per-indicator answers in the prompt, keyed on the context's own indicators", () => {
    const prompt = buildDeliverableUserPrompt(
      { ...baseContext, indicators: { "Taux de service": "95 % (estimate)" } },
      "kpi_dashboard",
      { "baseline:Taux de service": "92 % en octobre", "owner:Taux de service": "Resp. qualité", "baseline:Inconnu": "x" }
    );
    expect(prompt).toContain('Current measured baseline of indicator "Taux de service"');
    expect(prompt).toContain("92 % en octobre");
    expect(prompt).toContain("Resp. qualité");
    expect(prompt).not.toContain("Inconnu");
  });
});

describe("roadmap questionnaire", () => {
  it("asks dates (as date pickers), milestones, priority actions and expected deliverables", () => {
    const fields = getDeliverableInputFields("roadmap", "fr");
    expect(fields.map((f) => f.key)).toEqual([
      "startDate",
      "targetEndDate",
      "milestones",
      "priorityActions",
      "expectedDeliverables",
      "constraints",
    ]);
    expect(fields.filter((f) => f.inputType === "date").map((f) => f.key)).toEqual(["startDate", "targetEndDate"]);
  });

  it("builds an empty block when nothing is answered — the original path stays unchanged", () => {
    expect(buildInputsBlock("roadmap", {})).toBe("");
    expect(buildInputsBlock("roadmap", { milestones: "Go/No-go — 2026-03-15" })).toContain("Go/No-go — 2026-03-15");
  });
});

describe("buildMeasuredDataLines (automatic path)", () => {
  it("turns already-entered diagnostic, flow and benefit data into lines, figures from the pure calculators", () => {
    const lines = buildMeasuredDataLines({
      capabilities: [{ domain: "digitalization", observed: 2, target: 4, status: "vérifié" }],
      flow: {
        demand: 100,
        steps: [
          { id: "a", name: "Découpe", process: 1, wait: 3, capacity: 80 },
          { id: "b", name: "Soudure", process: 2, wait: 2, capacity: 120 },
        ],
      },
      benefits: { expectedAnnual: 500000, observations: [{ month: "2026-09", value: 10 }, { month: "2026-10", value: 20 }] },
    });
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("observé 2/5, cible 4/5");
    expect(lines[1]).toContain("délai total 8 j");
    expect(lines[1]).toContain("62.5 % d'attente");
    expect(lines[1]).toContain("goulot : Découpe (80 pièces/j)");
    expect(lines[2]).toContain("500000");
    expect(lines[3]).toContain("180"); // (10 + 20) / 2 × 12
  });

  it("skips invalid or missing sources rather than inventing a figure", () => {
    expect(
      buildMeasuredDataLines({ capabilities: [], flow: { demand: 10, steps: [] }, benefits: { expectedAnnual: null, observations: [] } })
    ).toEqual([]);
  });

  it("feeds the lines into every deliverable prompt", () => {
    const prompt = buildDeliverableUserPrompt({ ...baseContext, measuredData: ["Cartographie des flux D02 — délai total 8 j"] });
    expect(prompt).toContain("Données déjà mesurées");
    expect(prompt).toContain("délai total 8 j");
  });
});

describe("executive report — observation always paired with a solution", () => {
  const wrap = (content: unknown) => `<RESULT_JSON>${JSON.stringify({ title: "Rapport", content })}</RESULT_JSON>`;

  it("accepts observation/solution pairs", () => {
    const out = parseDeliverableOutput(
      "executive_report",
      wrap({
        summary: "Résumé court.",
        keyPoints: [
          { observation: "Stock 45 j", solution: "Flux tiré ligne 2 d'ici mars" },
          { observation: "Goulot découpe", solution: "2e équipe dès janvier" },
        ],
      })
    );
    expect(out.content).toMatchObject({ keyPoints: [{ observation: "Stock 45 j" }, { observation: "Goulot découpe" }] });
  });

  it("rejects a key point stated without its solution", () => {
    expect(() =>
      parseDeliverableOutput("executive_report", wrap({ summary: "x", keyPoints: ["Problème seul", "Autre problème"] }))
    ).toThrow();
    expect(() =>
      parseDeliverableOutput("executive_report", wrap({ summary: "x", keyPoints: [{ observation: "a" }, { observation: "b" }] }))
    ).toThrow();
  });

  it("states the problem→solution, concision and rigor rules in the system prompt", () => {
    const prompt = buildDeliverableSystemPrompt("executive_report", "fr");
    expect(prompt).toContain("Problem → solution, always");
    expect(prompt).toContain("no paragraph longer than 3-4 lines");
    expect(prompt).toContain("consulting-firm level");
  });
});
