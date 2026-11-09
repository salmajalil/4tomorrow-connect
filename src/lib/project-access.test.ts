import { describe, expect, it } from "vitest";
import { isAccessibleTransformation, type ProjectAccessScope } from "./project-access";

describe("isAccessibleTransformation", () => {
  const scope: ProjectAccessScope = {
    ownedOrganizations: [{ id: "org-own", name: "Usine A", industry: null }],
    memberTransformationIds: ["tx-member"],
  };

  it("garde un dossier d'une organisation possédée (cas propriétaire)", () => {
    expect(isAccessibleTransformation(scope, { id: "tx-1", organization_id: "org-own" })).toBe(true);
  });

  it("garde un dossier dont l'utilisateur est membre accepté", () => {
    expect(isAccessibleTransformation(scope, { id: "tx-member", organization_id: "org-other" })).toBe(true);
  });

  it("écarte tout autre dossier", () => {
    expect(isAccessibleTransformation(scope, { id: "tx-x", organization_id: "org-other" })).toBe(false);
  });

  it("écarte tout quand le périmètre est vide", () => {
    const empty: ProjectAccessScope = { ownedOrganizations: [], memberTransformationIds: [] };
    expect(isAccessibleTransformation(empty, { id: "tx-1", organization_id: "org-own" })).toBe(false);
  });
});
