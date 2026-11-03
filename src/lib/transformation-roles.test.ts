import { describe, expect, it } from "vitest";
import { canPerform, allowedActions, type TransformationActor } from "./transformation-roles";

describe("canPerform", () => {
  describe("owner", () => {
    it("can do everything regardless of declared role", () => {
      const owner: TransformationActor = { role: "client", isOwner: true };
      expect(canPerform(owner, "manage_members")).toBe(true);
      expect(canPerform(owner, "validate_decision")).toBe(true);
      expect(canPerform(owner, "edit_data", { module: "deliver" })).toBe(true);
    });
  });

  describe("consultant", () => {
    const consultant: TransformationActor = { role: "consultant" };
    it("modifie tout", () => {
      expect(canPerform(consultant, "read")).toBe(true);
      expect(canPerform(consultant, "comment")).toBe(true);
      expect(canPerform(consultant, "edit_data", { module: "decide" })).toBe(true);
      expect(canPerform(consultant, "edit_data", { module: "connect" })).toBe(true);
      expect(canPerform(consultant, "manage_members")).toBe(true);
    });
    it("envoie au CEO", () => {
      expect(canPerform(consultant, "send_to_ceo")).toBe(true);
    });
    it("ne valide jamais à la place du CEO", () => {
      expect(canPerform(consultant, "validate_decision")).toBe(false);
    });
  });

  describe("client", () => {
    const client: TransformationActor = { role: "client" };
    it("lit et commente partout", () => {
      expect(canPerform(client, "read")).toBe(true);
      expect(canPerform(client, "comment")).toBe(true);
    });
    it("modifie seulement les données de son usine (module decide)", () => {
      expect(canPerform(client, "edit_data", { module: "decide" })).toBe(true);
    });
    it("ne modifie pas les autres modules", () => {
      expect(canPerform(client, "edit_data", { module: "connect" })).toBe(false);
      expect(canPerform(client, "edit_data", { module: "deliver" })).toBe(false);
      expect(canPerform(client, "edit_data", { module: "learn" })).toBe(false);
    });
    it("ne gère pas l'équipe ni ne valide", () => {
      expect(canPerform(client, "manage_members")).toBe(false);
      expect(canPerform(client, "validate_decision")).toBe(false);
      expect(canPerform(client, "send_to_ceo")).toBe(false);
    });
  });

  describe("expert", () => {
    const expertDecide: TransformationActor = { role: "expert", domain: "decide" };
    it("consulte et commente partout", () => {
      expect(canPerform(expertDecide, "read")).toBe(true);
      expect(canPerform(expertDecide, "comment")).toBe(true);
    });
    it("modifie seulement son domaine déclaré", () => {
      expect(canPerform(expertDecide, "edit_data", { module: "decide" })).toBe(true);
      expect(canPerform(expertDecide, "edit_data", { module: "deliver" })).toBe(false);
    });
    it("sans domaine déclaré, ne peut rien éditer", () => {
      const noDomain: TransformationActor = { role: "expert", domain: null };
      expect(canPerform(noDomain, "edit_data", { module: "decide" })).toBe(false);
    });
    it("sans module dans le contexte, ne peut pas éditer même dans son propre domaine", () => {
      expect(canPerform(expertDecide, "edit_data", {})).toBe(false);
    });
    it("ne gère pas l'équipe ni ne valide", () => {
      expect(canPerform(expertDecide, "manage_members")).toBe(false);
      expect(canPerform(expertDecide, "validate_decision")).toBe(false);
    });
  });

  describe("ceo", () => {
    const ceo: TransformationActor = { role: "ceo" };
    it("valide, demande un complément ou refuse (validate_decision couvre les trois boutons)", () => {
      expect(canPerform(ceo, "validate_decision")).toBe(true);
    });
    it("lit et commente (peut poser une question)", () => {
      expect(canPerform(ceo, "read")).toBe(true);
      expect(canPerform(ceo, "comment")).toBe(true);
    });
    it("ne modifie jamais de données et ne gère pas l'équipe", () => {
      expect(canPerform(ceo, "edit_data", { module: "decide" })).toBe(false);
      expect(canPerform(ceo, "manage_members")).toBe(false);
      expect(canPerform(ceo, "send_to_ceo")).toBe(false);
    });
  });
});

describe("allowedActions", () => {
  it("renvoie exactement les actions permises pour un client", () => {
    expect(allowedActions({ role: "client" }, { module: "decide" }).sort()).toEqual(["comment", "edit_data", "read"].sort());
  });

  it("renvoie toutes les actions pour le propriétaire", () => {
    expect(allowedActions({ role: "ceo", isOwner: true }, { module: "decide" }).sort()).toEqual(
      ["comment", "edit_data", "manage_members", "read", "send_to_ceo", "validate_decision"].sort()
    );
  });
});
