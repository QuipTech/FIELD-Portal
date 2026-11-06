import { describe, expect, it } from "vitest";
import { formatCodeTimeLeft, formatPairingCode } from "./machineAppConnection";

describe("pairing code display", () => {
  it("splits the code in two, keeping leading zeros", () => {
    expect(formatPairingCode("012345")).toBe("012 345");
  });

  it("counts down in minutes and seconds, stopping at zero", () => {
    const expiresAt = "2026-11-06T12:15:00.000Z";
    expect(formatCodeTimeLeft(expiresAt, Date.parse("2026-11-06T12:00:00.000Z"))).toBe("15:00");
    expect(formatCodeTimeLeft(expiresAt, Date.parse("2026-11-06T12:14:55.000Z"))).toBe("0:05");
    expect(formatCodeTimeLeft(expiresAt, Date.parse("2026-11-06T12:16:00.000Z"))).toBe("0:00");
  });
});
