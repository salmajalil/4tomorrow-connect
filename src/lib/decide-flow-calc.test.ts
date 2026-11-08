import { describe, expect, it } from "vitest";
import {
  computeFlow,
  emptyLevers,
  flowInputsSignature,
  parseFlowCsv,
  validateFlowInputs,
  type FlowStepInput,
} from "./decide-flow-calc";

function steps(overrides: Partial<FlowStepInput>[] = []): FlowStepInput[] {
  const base: FlowStepInput[] = [
    { id: "a", name: "Réception", process: 1, wait: 2, capacity: 120 },
    { id: "b", name: "Contrôle", process: 0.5, wait: 1, capacity: 80 },
    { id: "c", name: "Expédition", process: 1, wait: 0.5, capacity: 150 },
  ];
  return base.map((s, i) => ({ ...s, ...overrides[i] }));
}

describe("computeFlow", () => {
  it("computes délai = somme(traitement) + somme(attente)", () => {
    const { current } = computeFlow(steps(), 50);
    expect(current.process).toBe(2.5); // 1 + 0.5 + 1
    expect(current.wait).toBe(3.5); // 2 + 1 + 0.5
    expect(current.lead).toBe(6);
  });

  it("picks the step with the lowest capacity as the bottleneck", () => {
    const { current } = computeFlow(steps(), 50);
    expect(current.bottleneck.id).toBe("b"); // capacity 80, the lowest
    expect(current.bottleneck.capacity).toBe(80);
  });

  it("breaks a bottleneck capacity tie deterministically (first step in input order wins)", () => {
    const tied = steps([{ capacity: 80 }, { capacity: 80 }]);
    const { current } = computeFlow(tied, 50);
    expect(current.bottleneck.id).toBe("a");
  });

  it("flags demand as covered when the bottleneck's capacity meets or exceeds it", () => {
    expect(computeFlow(steps(), 80).current.demandCovered).toBe(true);
    expect(computeFlow(steps(), 80.01).current.demandCovered).toBe(false);
  });

  it("computes deficit = max(0, demand - bottleneck capacity), never negative", () => {
    expect(computeFlow(steps(), 50).current.deficit).toBe(0); // demand below bottleneck capacity
    expect(computeFlow(steps(), 100).current.deficit).toBe(20); // 100 - 80
  });

  it("computes throughput = min(bottleneck capacity, demand)", () => {
    expect(computeFlow(steps(), 50).current.throughput).toBe(50);
    expect(computeFlow(steps(), 200).current.throughput).toBe(80);
  });

  it("never applies levers to the original steps — only to a copy", () => {
    const original = steps();
    const snapshot = JSON.parse(JSON.stringify(original));
    computeFlow(original, 50, { waitCut: { a: 100 }, capAdd: { b: 1000 } });
    expect(original).toEqual(snapshot);
  });

  it("applies waitCut only to the simulated copy, never the current summary", () => {
    const result = computeFlow(steps(), 50, { waitCut: { a: 100 }, capAdd: {} });
    expect(result.current.wait).toBe(3.5); // unchanged
    expect(result.simulated.wait).toBe(1.5); // step a's 2-day wait cut to 0
  });

  it("applies capAdd only to the simulated copy, never the current summary", () => {
    const result = computeFlow(steps(), 50, { waitCut: {}, capAdd: { b: 40 } });
    expect(result.current.bottleneck.capacity).toBe(80);
    expect(result.simulated.bottleneck.capacity).toBe(120); // b: 80 + 40, now tied with a, a wins (lower id order unaffected since equal to a's 120 -> a is first in reduce w/ < comparison, stays a... )
  });

  it("computes gainDays = current lead - simulated lead (positive = improvement)", () => {
    const result = computeFlow(steps(), 50, { waitCut: { a: 50 }, capAdd: {} });
    expect(result.gainDays).toBe(1); // half of step a's 2-day wait (1 day) removed from lead
  });

  it("clamps waitCut to [0, 100] and capAdd to >= 0", () => {
    const result = computeFlow(steps(), 50, { waitCut: { a: 500 }, capAdd: { b: -1000 } });
    expect(result.simulated.wait).toBe(1.5); // waitCut clamped to 100%, same as full cut of step a's 2 days
    expect(result.simulated.bottleneck.capacity).toBe(80); // negative capAdd has no effect
  });

  it("is a pure function: same input always yields the same output", () => {
    const s = steps();
    const levers = { waitCut: { a: 20 }, capAdd: { c: 5 } };
    expect(computeFlow(s, 50, levers)).toEqual(computeFlow(s, 50, levers));
  });

  it("defaults to empty levers (simulated equals current) when none are given", () => {
    const result = computeFlow(steps(), 50);
    expect(result.simulated).toEqual(result.current);
    expect(result.gainDays).toBe(0);
  });
});

describe("validateFlowInputs", () => {
  it("accepts a well-formed set of steps and demand", () => {
    expect(validateFlowInputs(steps(), 50)).toEqual([]);
  });

  it("rejects an empty steps array", () => {
    const errors = validateFlowInputs([], 50);
    expect(errors.some((e) => e.includes("Au moins une étape"))).toBe(true);
  });

  it("rejects a negative or non-finite process/wait value", () => {
    const errors = validateFlowInputs(steps([{ process: -1 }]), 50);
    expect(errors.some((e) => e.includes("traitement"))).toBe(true);
  });

  it("rejects a zero or negative capacity", () => {
    const errors = validateFlowInputs(steps([{ capacity: 0 }]), 50);
    expect(errors.some((e) => e.includes("capacité"))).toBe(true);
  });

  it("rejects a negative demand", () => {
    const errors = validateFlowInputs(steps(), -5);
    expect(errors.some((e) => e.includes("demande"))).toBe(true);
  });

  it("rejects a step with an empty name", () => {
    const errors = validateFlowInputs(steps([{ name: "" }]), 50);
    expect(errors.some((e) => e.includes("nom de l'étape"))).toBe(true);
  });
});

describe("parseFlowCsv", () => {
  it("parses a well-formed CSV with header", () => {
    const { steps: parsed, errors } = parseFlowCsv(
      "étape;traitement;attente;capacité\nRéception;1;2;120\nContrôle;0.5;1;80\n"
    );
    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ name: "Réception", process: 1, wait: 2, capacity: 120 });
    expect(parsed[1]).toMatchObject({ name: "Contrôle", process: 0.5, wait: 1, capacity: 80 });
  });

  it("accepts a comma as decimal separator", () => {
    const { steps: parsed, errors } = parseFlowCsv("étape;traitement;attente;capacité\nContrôle;0,5;1,5;80\n");
    expect(errors).toEqual([]);
    expect(parsed[0]).toMatchObject({ process: 0.5, wait: 1.5, capacity: 80 });
  });

  it("reports the line number and what to fix for a malformed row", () => {
    const { errors } = parseFlowCsv("étape;traitement;attente;capacité\nRéception;1;2;120\nContrôle;abc;1;80\n");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Ligne 3");
    expect(errors[0]).toContain("traitement");
  });

  it("reports an error for a row with the wrong number of columns", () => {
    const { errors } = parseFlowCsv("étape;traitement;attente;capacité\nRéception;1;2\n");
    expect(errors[0]).toContain("Ligne 2");
    expect(errors[0]).toContain("4 colonnes");
  });

  it("rejects a zero or negative capacity with a line-specific message", () => {
    const { errors } = parseFlowCsv("étape;traitement;attente;capacité\nRéception;1;2;0\n");
    expect(errors[0]).toContain("Ligne 2");
    expect(errors[0]).toContain("capacité");
  });

  it("returns an error for an empty file", () => {
    expect(parseFlowCsv("").errors).toEqual(["Le fichier est vide."]);
  });

  it("tolerates a missing/incorrect header by treating every line as data, flagged at line 1", () => {
    const { steps: parsed, errors } = parseFlowCsv("Réception;1;2;120\n");
    expect(errors.some((e) => e.includes("Ligne 1"))).toBe(true);
    expect(parsed).toHaveLength(1);
  });
});

describe("flowInputsSignature", () => {
  it("is identical for the same steps/demand/levers", () => {
    const s = steps();
    expect(flowInputsSignature(s, 50, emptyLevers())).toBe(flowInputsSignature(s, 50, emptyLevers()));
  });

  it("changes when a step value changes", () => {
    const sig1 = flowInputsSignature(steps(), 50, emptyLevers());
    const sig2 = flowInputsSignature(steps([{ capacity: 999 }]), 50, emptyLevers());
    expect(sig1).not.toBe(sig2);
  });

  it("changes when the demand changes", () => {
    const sig1 = flowInputsSignature(steps(), 50, emptyLevers());
    const sig2 = flowInputsSignature(steps(), 51, emptyLevers());
    expect(sig1).not.toBe(sig2);
  });
});
