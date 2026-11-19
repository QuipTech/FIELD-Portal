import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMachinesRequest } from "@/lib/api/machineFleetApi";
import type { FleetMachine } from "@/lib/types/machineFleet";
import { ConnectMachinePicker } from "./connectMachinePicker";

vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "token" }));
vi.mock("@/lib/api/machineFleetApi", () => ({ EMPTY_MACHINE_FILTERS: {}, listMachinesRequest: vi.fn() }));

const machine = (label: string, overrides: Partial<FleetMachine> = {}) =>
  ({
    id: label,
    label,
    manufacturer: "CAT",
    model: "D10T",
    site: null,
    lifecycleState: "active",
    appConnected: false,
    isShared: false,
    accessLevel: "owner",
    groups: [],
    owningOrganisationName: "TRT",
    ...overrides,
  }) as unknown as FleetMachine;

describe("ConnectMachinePicker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lets you pick only machines that can take a tablet", async () => {
    vi.mocked(listMachinesRequest).mockResolvedValue({
      items: [
        machine("READY"),
        machine("PAIRED", { appConnected: true }),
        machine("ASLEEP", { lifecycleState: "registered" }),
        machine("LOOKING", { accessLevel: "view", isShared: true }),
      ],
    } as never);
    const onPick = vi.fn();
    render(<ConnectMachinePicker onPick={onPick} onClose={vi.fn()} />);
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("Not active")).toBeTruthy();
    expect(screen.getByText("View only")).toBeTruthy();
    fireEvent.click(screen.getByText("PAIRED"));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("READY"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "READY" }));
  });
});
