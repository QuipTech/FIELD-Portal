import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageMachineGroupsModal } from "./manageMachineGroupsModal";
import { getMachineGroupsRequest, listMachineGroupsRequest, setMachineGroupsRequest } from "@/lib/api/adminMachineGroupsApi";

vi.mock("@/lib/api/adminMachineGroupsApi", () => ({
  getMachineGroupsRequest: vi.fn(),
  listMachineGroupsRequest: vi.fn(),
  setMachineGroupsRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const group = (id: string, name: string) => ({ id, name, colour: null }) as never;
const machine = { id: "m1", label: "PLANT-1" };

describe("managing a machine's groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMachineGroupsRequest).mockResolvedValue([group("g1", "North"), group("g2", "South")]);
    vi.mocked(getMachineGroupsRequest).mockResolvedValue([{ id: "g1", name: "North" }]);
    vi.mocked(setMachineGroupsRequest).mockResolvedValue([]);
  });

  it("moves a machine: summarises the change, warns about access, saves both at once", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<ManageMachineGroupsModal machine={machine} onSaved={onSaved} onClose={onClose} />);
    const north = await screen.findByRole("checkbox", { name: "North" });
    const save = screen.getByRole("button", { name: "Save groups" }) as HTMLButtonElement;
    expect((north as HTMLInputElement).checked).toBe(true);
    expect(save.disabled).toBe(true);

    fireEvent.click(north);
    fireEvent.click(screen.getByRole("checkbox", { name: "South" }));
    expect(screen.getByText("Adding to: South")).toBeTruthy();
    expect(screen.getByText("Removing from: North")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("stops seeing PLANT-1");

    fireEvent.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Groups updated for PLANT-1."));
    expect(setMachineGroupsRequest).toHaveBeenCalledWith("test-token", "m1", ["g2"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("doesn't warn when only adding, and stays open with the error if saving fails", async () => {
    vi.mocked(setMachineGroupsRequest).mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    render(<ManageMachineGroupsModal machine={machine} onSaved={vi.fn()} onClose={onClose} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "South" }));
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save groups" }));
    await screen.findByText(/Couldn't update the groups|nope/);
    expect(onClose).not.toHaveBeenCalled();
  });
});
