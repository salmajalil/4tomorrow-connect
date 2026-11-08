import { describe, expect, it } from "vitest";
import {
  DELIVERABLE_KINDS,
  buildDeliverableUserPrompt,
  getDeliverableInputFields,
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
      expect(fr.length).toBeLessThanOrEqual(5);
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
