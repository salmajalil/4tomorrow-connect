import { describe, it, expect } from "vitest";
import {
  computeExpiresAt,
  evaluateConsumption,
  isTokenStillUsable,
  VALIDATION_TOKEN_TTL_MS,
  type ValidationTokenRecord,
  type CurrentDecisionState,
} from "./validation-token";

const issuedAt = new Date("2026-01-01T00:00:00Z");
const token: ValidationTokenRecord = {
  transformationId: "tx-1",
  trajectoryId: "traj-1",
  decisionSnapshot: "2025-12-31T23:00:00Z",
  expiresAt: computeExpiresAt(issuedAt),
  usedAt: null,
};
const current: CurrentDecisionState = {
  transformationId: "tx-1",
  trajectoryId: "traj-1",
  decisionUpdatedAt: "2025-12-31T23:00:00Z",
};

describe("computeExpiresAt", () => {
  it("expires exactly 72h after issuance", () => {
    expect(Date.parse(computeExpiresAt(issuedAt)) - issuedAt.getTime()).toBe(VALIDATION_TOKEN_TTL_MS);
  });
});

describe("evaluateConsumption", () => {
  it("rejects when confirmation is not explicit — opening the link alone validates nothing", () => {
    const result = evaluateConsumption(token, current, issuedAt, false);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Confirmation explicite/);
  });

  it("accepts a fresh, matching, explicitly confirmed token", () => {
    const result = evaluateConsumption(token, current, issuedAt, true);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects a token already used", () => {
    const used = { ...token, usedAt: "2026-01-01T01:00:00Z" };
    const result = evaluateConsumption(used, current, issuedAt, true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/déjà été utilisé/);
  });

  it("rejects an expired token", () => {
    const now = new Date(Date.parse(token.expiresAt) + 1000);
    const result = evaluateConsumption(token, current, now, true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expiré/);
  });

  it("rejects when the decision's trajectory changed since the link was sent", () => {
    const movedOn: CurrentDecisionState = { ...current, trajectoryId: "traj-2" };
    const result = evaluateConsumption(token, movedOn, issuedAt, true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/décision a changé/);
  });

  it("rejects when the decision's content changed (same trajectory, newer snapshot) since the link was sent", () => {
    const edited: CurrentDecisionState = { ...current, decisionUpdatedAt: "2026-01-01T00:30:00Z" };
    const result = evaluateConsumption(token, edited, issuedAt, true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/décision a changé/);
  });

  it("rejects a token issued for a different transformation entirely", () => {
    const other: CurrentDecisionState = { ...current, transformationId: "tx-2" };
    const result = evaluateConsumption(token, other, issuedAt, true);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/autre projet/);
  });
});

describe("isTokenStillUsable", () => {
  it("mirrors evaluateConsumption's validity checks without requiring the caller to pass confirmation", () => {
    expect(isTokenStillUsable(token, current, issuedAt).ok).toBe(true);
    const used = { ...token, usedAt: "2026-01-01T01:00:00Z" };
    expect(isTokenStillUsable(used, current, issuedAt).ok).toBe(false);
  });
});
