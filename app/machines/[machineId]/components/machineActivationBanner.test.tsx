import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "@/lib/types/machine";
import { MachineActivationBanner } from "./machineActivationBanner";

const permissions = vi.hoisted(() => ({ granted: ["machine.lifecycle"] as string[] }));

vi.mock("@/lib/auth/usePermissions", () => ({
  usePermissions: () => ({ isLoaded: true, can: (code: string) => permissions.granted.includes(code) }),
}));

const machine: Machine = {
  id: "7deaae45-e6a0-4745-8152-a66e48927a1f",
  assetId: "HT2202",
  manufacturer: "CAT",
  model: "D10T",
  modelId: null,
  serialNumber: "464353343",
  plantId: "HT2202",
  status: "running",
  operatingHours: 3,
  hoursReadAt: null,
  site: "Pit4",
  owner: null,
  openCaseCount: 0,
  lifecycleState: "registered",
};

afterEach(() => {
  cleanup();
  permissions.granted = ["machine.lifecycle"];
});

describe("machine activation banner", () => {
  it("shows nothing for an active machine", () => {
    const { container } = render(
      <MachineActivationBanner machine={{ ...machine, lifecycleState: "active" }} onActivated={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });

  it("explains a registered machine and confirms before activating", () => {
    render(<MachineActivationBanner machine={machine} onActivated={() => {}} />);
    expect(screen.getByText("This machine is registered but not active yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activate machine" }));
    expect(screen.getByRole("dialog", { name: "Activate HT2202" })).toBeTruthy();
  });

  it("offers reactivation for an archived machine and nothing for a sold one", () => {
    render(<MachineActivationBanner machine={{ ...machine, lifecycleState: "archived" }} onActivated={() => {}} />);
    expect(screen.getByRole("button", { name: "Reactivate machine" })).toBeTruthy();
    cleanup();
    render(<MachineActivationBanner machine={{ ...machine, lifecycleState: "sold" }} onActivated={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("locks the button without the lifecycle permission", () => {
    permissions.granted = [];
    render(<MachineActivationBanner machine={machine} onActivated={() => {}} />);
    expect((screen.getByRole("button", { name: /Activate machine/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
