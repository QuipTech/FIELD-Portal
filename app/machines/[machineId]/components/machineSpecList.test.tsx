import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "@/lib/types/machine";
import { MachineSpecList } from "./machineSpecList";

const state = vi.hoisted(() => ({ machine: null as unknown, granted: [] as string[] }));

vi.mock("@/lib/auth/usePermissions", () => ({
  usePermissions: () => ({ isLoaded: true, can: (code: string) => state.granted.includes(code) }),
}));
vi.mock("../machineDetailContext", () => ({
  useMachineDetail: () => ({ machine: state.machine, reloadMachine: vi.fn(), notify: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("@/lib/api/machineFleetApi", () => ({
  EMPTY_MACHINE_FILTERS: {},
  listMachinesRequest: vi.fn(() => new Promise(() => undefined)),
  updateMachineDetailsRequest: vi.fn(),
  correctMachineIdentifiersRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const ROW_EDIT = /^Edit (plant id|serial number|site)$/;

const own = {
  id: "m1",
  assetId: "ABC-01",
  plantId: "ABC-01",
  serialNumber: "SER-1",
  operatingHours: 3423,
  hoursReadAt: null,
  site: "Pit4",
  owner: null,
  groups: [],
  owningOrganisationName: "Pit Crew",
  isShared: false,
  accessLevel: "owner",
} as unknown as Machine;
const shared = { ...own, isShared: true, accessLevel: "contribute", owningOrganisationName: "TRT" } as Machine;

const renderAs = (machine: Machine, granted: string[]) => {
  state.machine = machine;
  state.granted = granted;
  render(<MachineSpecList />);
};

describe("machine spec list edit buttons", () => {
  it("puts Edit before Copy on Plant ID and Serial, and edits Site, for the owner", () => {
    renderAs(own, ["machine.manage"]);
    const plantRow = screen.getByRole("button", { name: "Edit plant id" }).parentElement!;
    const labels = Array.from(plantRow.querySelectorAll("button")).map((button) => button.textContent);
    expect(labels).toEqual(["Edit", "Copy"]);
    expect(screen.getByRole("button", { name: "Edit serial number" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit site" }));
    expect(screen.getByRole("dialog", { name: "Edit machine" })).toBeTruthy();
  });

  it("lets the platform administrator edit a shared machine, site only", () => {
    renderAs(shared, ["machine.manage", "platform.manage"]);
    expect(screen.getByRole("button", { name: "Edit plant id" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit serial number" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit site" }));
    const dialog = screen.getByRole("dialog", { name: "Edit site" });
    expect(within(dialog).queryByText("Hours")).toBeNull();
    expect(within(dialog).getByText("Site")).toBeTruthy();
  });

  it("shows only Copy on a shared machine for everyone else", () => {
    renderAs(shared, ["machine.manage"]);
    expect(screen.queryByRole("button", { name: ROW_EDIT })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy plant id" })).toBeTruthy();
  });

  it("shows only Copy without Edit machine records", () => {
    renderAs(own, []);
    expect(screen.queryByRole("button", { name: ROW_EDIT })).toBeNull();
  });
});
