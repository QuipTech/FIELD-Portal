import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMachineControlOrganisationsRequest, setMachineControlRequest } from "@/lib/api/adminMachineControlApi";
import { MachineControlOrganisations } from "./machineControlOrganisations";

vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "token" }));
vi.mock("@/lib/api/adminMachineControlApi", () => ({
  listMachineControlOrganisationsRequest: vi.fn(),
  setMachineControlRequest: vi.fn(),
}));

const flush = () => act(async () => undefined);

describe("MachineControlOrganisations", () => {
  beforeEach(() => {
    vi.mocked(listMachineControlOrganisationsRequest).mockResolvedValue([
      { id: "t1", name: "TRT", machineControlEnabled: true, activeMachineCount: 2, connectedDeviceCount: 1 },
      { id: "t2", name: "Tovo solution", machineControlEnabled: false, activeMachineCount: 0, connectedDeviceCount: 0 },
    ]);
    vi.mocked(setMachineControlRequest).mockImplementation(async (id, enabled) => ({ id, machineControlEnabled: enabled }));
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("turns an organisation on straight away", async () => {
    render(<MachineControlOrganisations />);
    await flush();
    fireEvent.click(screen.getAllByRole("switch")[1]);
    await flush();
    expect(setMachineControlRequest).toHaveBeenCalledWith("t2", true);
    expect(screen.getAllByRole("switch")[1].getAttribute("aria-checked")).toBe("true");
  });

  it("asks before turning an organisation off", async () => {
    render(<MachineControlOrganisations />);
    await flush();
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(setMachineControlRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await flush();
    expect(setMachineControlRequest).toHaveBeenCalledWith("t1", false);
  });
});
