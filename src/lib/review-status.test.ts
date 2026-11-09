import { describe, expect, it } from "vitest";
import {
  canReview,
  evaluateReviewTransition,
  filterVisible,
  filterVisibleDeliverables,
  isReviewStatus,
  isVisibleTo,
  nextReviewStatus,
  normalizeReviewStatus,
} from "./review-status";
import type { TransformationActor } from "./transformation-roles";

const owner: TransformationActor = { role: "consultant", isOwner: true };
const consultant: TransformationActor = { role: "consultant" };
const client: TransformationActor = { role: "client" };
const ceo: TransformationActor = { role: "ceo" };
const expert: TransformationActor = { role: "expert", domain: "deliver" };

describe("normalizeReviewStatus", () => {
  it("garde une valeur connue", () => {
    expect(normalizeReviewStatus("validated")).toBe("validated");
    expect(isReviewStatus("reviewed")).toBe(true);
  });

  it("traite une valeur absente ou inconnue comme un brouillon IA", () => {
    expect(normalizeReviewStatus(undefined)).toBe("ai_draft");
    expect(normalizeReviewStatus("approved")).toBe("ai_draft");
    expect(isReviewStatus(null)).toBe(false);
  });
});

describe("canReview", () => {
  it("propriétaire et consultant oui, client / expert / CEO / inconnu non", () => {
    expect(canReview(owner)).toBe(true);
    expect(canReview(consultant)).toBe(true);
    expect(canReview(client)).toBe(false);
    expect(canReview(expert)).toBe(false);
    expect(canReview(ceo)).toBe(false);
    expect(canReview(null)).toBe(false);
  });
});

describe("isVisibleTo", () => {
  it("un brouillon IA n'est visible que du propriétaire / consultant", () => {
    expect(isVisibleTo(owner, "ai_draft")).toBe(true);
    expect(isVisibleTo(consultant, "ai_draft")).toBe(true);
    expect(isVisibleTo(client, "ai_draft")).toBe(false);
    expect(isVisibleTo(ceo, "ai_draft")).toBe(false);
  });

  it("un livrable revu ou validé est visible de tous les membres", () => {
    for (const actor of [owner, consultant, client, ceo, expert]) {
      expect(isVisibleTo(actor, "reviewed")).toBe(true);
      expect(isVisibleTo(actor, "validated")).toBe(true);
    }
  });

  it("un acteur inconnu ne voit rien", () => {
    expect(isVisibleTo(null, "validated")).toBe(false);
  });
});

describe("filterVisible", () => {
  const rows = [
    { id: "a", review_status: "ai_draft" },
    { id: "b", review_status: "reviewed" },
    { id: "c", review_status: "validated" },
    { id: "d" }, // ligne antérieure à 0026 : brouillon
  ];

  it("retire les brouillons pour le CEO", () => {
    expect(filterVisible(ceo, rows).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("garde tout pour le consultant", () => {
    expect(filterVisible(consultant, rows).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("transitions", () => {
  it("monte d'un cran à la fois", () => {
    expect(nextReviewStatus("ai_draft")).toBe("reviewed");
    expect(nextReviewStatus("reviewed")).toBe("validated");
    expect(nextReviewStatus("validated")).toBeNull();
  });

  it("accepte ai_draft → reviewed puis reviewed → validated pour le consultant", () => {
    expect(evaluateReviewTransition(consultant, "ai_draft", "reviewed")).toEqual({ ok: true });
    expect(evaluateReviewTransition(owner, "reviewed", "validated")).toEqual({ ok: true });
  });

  it("refuse de valider un brouillon IA sans relecture", () => {
    expect(evaluateReviewTransition(owner, "ai_draft", "validated")).toEqual({ ok: false, code: "invalid_transition" });
  });

  it("refuse de revenir en arrière ou de re-valider", () => {
    expect(evaluateReviewTransition(owner, "validated", "reviewed")).toEqual({ ok: false, code: "invalid_transition" });
    expect(evaluateReviewTransition(owner, "validated", "validated")).toEqual({ ok: false, code: "invalid_transition" });
  });

  it("refuse au client et au CEO, quel que soit le statut", () => {
    expect(evaluateReviewTransition(client, "ai_draft", "reviewed")).toEqual({ ok: false, code: "not_allowed" });
    expect(evaluateReviewTransition(ceo, "reviewed", "validated")).toEqual({ ok: false, code: "not_allowed" });
  });
});

describe("filterVisibleDeliverables", () => {
  const rows = [
    { kind: "executive_report", review_status: "ai_draft" },
    { kind: "action_plan", review_status: "ai_draft" },
  ];

  it("masque l'executive report en brouillon IA au client, sans toucher aux autres livrables", () => {
    const { visible, hiddenDraftKinds } = filterVisibleDeliverables(client, rows);
    expect(visible.map((r) => r.kind)).toEqual(["action_plan"]);
    expect(hiddenDraftKinds).toEqual(["executive_report"]);
  });

  it("le consultant voit tout", () => {
    const { visible, hiddenDraftKinds } = filterVisibleDeliverables(consultant, rows);
    expect(visible).toHaveLength(2);
    expect(hiddenDraftKinds).toEqual([]);
  });

  it("l'executive report revu redevient visible pour le CEO", () => {
    const { visible } = filterVisibleDeliverables(ceo, [{ kind: "executive_report", review_status: "reviewed" }]);
    expect(visible).toHaveLength(1);
  });
});
