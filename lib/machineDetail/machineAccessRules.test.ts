import { describe, expect, it } from "vitest";
import { canContributeTo, isOwnMachine } from "./machineAccessRules";

describe("machine access rules", () => {
  it("lets owners and contribute shares add to a machine, never view shares", () => {
    expect(canContributeTo({ isShared: false, accessLevel: "owner" })).toBe(true);
    expect(canContributeTo({ isShared: true, accessLevel: "contribute" })).toBe(true);
    expect(canContributeTo({ isShared: true, accessLevel: "view" })).toBe(false);
    expect(canContributeTo(null)).toBe(false);
  });

  it("keeps editing and lifecycle to the owning organisation", () => {
    expect(isOwnMachine({ isShared: false, accessLevel: "owner" })).toBe(true);
    expect(isOwnMachine({ isShared: true, accessLevel: "contribute" })).toBe(false);
    expect(isOwnMachine(null)).toBe(false);
  });
});
