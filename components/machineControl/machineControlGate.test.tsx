import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MachineControlGate } from "./machineControlGate";

const access = { isLoaded: true, machineControlEnabled: true, granted: ["mc.view"] };
vi.mock("@/lib/auth/usePermissions", () => ({
  usePermissions: () => ({
    isLoaded: access.isLoaded,
    machineControlEnabled: access.machineControlEnabled,
    can: (code: string) => access.granted.includes(code),
  }),
}));

afterEach(() => {
  cleanup();
  Object.assign(access, { isLoaded: true, machineControlEnabled: true, granted: ["mc.view"] });
});

const renderGate = () => render(<MachineControlGate><span>Module</span></MachineControlGate>);

describe("MachineControlGate", () => {
  it("shows the module with the switch on and mc.view", () => {
    renderGate();
    expect(screen.getByText("Module")).toBeTruthy();
  });

  it("explains when the organisation doesn't have it", () => {
    access.machineControlEnabled = false;
    renderGate();
    expect(screen.queryByText("Module")).toBeNull();
    expect(screen.getByText("Machine Control isn't turned on yet")).toBeTruthy();
  });

  it("explains a missing permission", () => {
    access.granted = [];
    renderGate();
    expect(screen.queryByText("Module")).toBeNull();
    expect(screen.getByText("No access to Machine Control")).toBeTruthy();
  });
});
