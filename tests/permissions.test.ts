import { describe, expect, it } from "vitest";
import {
  CONNECTORS,
  DEFAULT_ONBOARDING_SCOPES,
  allScopes,
  findConnector,
  findScope,
} from "@/modules/permissions/catalog";

describe("permission catalogue", () => {
  it("never enables an R3 or R4 scope", () => {
    for (const scope of allScopes()) {
      if (scope.risk === "R3" || scope.risk === "R4") {
        expect(scope.enabled, `${scope.id} must stay disabled`).toBe(false);
      }
    }
  });

  it("enables only R0–R2 scopes", () => {
    for (const scope of allScopes().filter((candidate) => candidate.enabled)) {
      expect(["R0", "R1", "R2"]).toContain(scope.risk);
    }
  });

  it("ships an onboarding set that exists and is enabled", () => {
    expect(DEFAULT_ONBOARDING_SCOPES.length).toBeGreaterThan(0);
    for (const scopeId of DEFAULT_ONBOARDING_SCOPES) {
      const found = findScope(scopeId);
      expect(found, `${scopeId} must exist`).toBeDefined();
      expect(found?.scope.enabled, `${scopeId} must be grantable`).toBe(true);
    }
  });

  it("keeps external connectors visibly unconnected", () => {
    for (const connectorId of ["bos", "khapy", "mothertracker"]) {
      const connector = findConnector(connectorId);
      expect(connector).toBeDefined();
      expect(connector?.state).toBe("needs_credentials");
      expect(connector?.scopes.every((scope) => !scope.enabled)).toBe(true);
      expect(connector?.stateNote.length).toBeGreaterThan(20);
    }
  });

  it("does not include a send or publish scope in onboarding", () => {
    for (const scopeId of DEFAULT_ONBOARDING_SCOPES) {
      expect(scopeId).not.toMatch(/\.(send|publish|transfer|delete|approve)$/);
    }
  });

  it("exposes every connector id only once", () => {
    const ids = CONNECTORS.map((connector) => connector.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
