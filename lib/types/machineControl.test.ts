import { describe, expect, it } from "vitest";
import { describeTablet, matchesDeviceSearch, summariseDevices, type McDevice } from "./machineControl";

const device = (overrides: Partial<McDevice> = {}): McDevice => ({
  id: "d1",
  machine: { id: "m1", label: "ABC-01", manufacturer: "CAT", model: "D10T", site: "Pit4" },
  serialNumber: "TAB-001",
  platform: "android",
  appVersion: "1.2.0",
  pairedAt: "2026-11-01T00:00:00.000Z",
  online: true,
  lastSeenAt: null,
  ...overrides,
});

describe("machine control devices", () => {
  it("counts connected, online and still-to-connect machines", () => {
    const list = { items: [device(), device({ id: "d2", online: false })], connectableMachineCount: 5 };
    expect(summariseDevices(list)).toEqual({ connected: 2, online: 1, notConnected: 3 });
  });

  it("never shows a negative number still to connect", () => {
    expect(summariseDevices({ items: [device()], connectableMachineCount: 0 }).notConnected).toBe(0);
  });

  it("describes the tablet with what it sent", () => {
    expect(describeTablet(device())).toBe("Android · TAB-001 · v1.2.0");
    expect(describeTablet(device({ platform: null, serialNumber: null, appVersion: null }))).toBe("Tablet details not sent yet");
  });

  it("finds a device by machine, site or tablet serial", () => {
    expect(matchesDeviceSearch(device(), "abc")).toBe(true);
    expect(matchesDeviceSearch(device(), "pit4")).toBe(true);
    expect(matchesDeviceSearch(device(), "tab-001")).toBe(true);
    expect(matchesDeviceSearch(device(), "nope")).toBe(false);
  });
});
