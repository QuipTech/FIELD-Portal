import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MoveToGroupDialog } from "./moveToGroupDialog";
import { ApiError } from "@/lib/api/httpClient";
import { listMachineGroupsRequest, moveMachinesToGroupRequest } from "@/lib/api/adminMachineGroupsApi";

vi.mock("@/lib/api/adminMachineGroupsApi", () => ({
  listMachineGroupsRequest: vi.fn(),
  moveMachinesToGroupRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const group = (id: string, name: string, machineCount = 0) => ({ id, name, colour: null, machineCount }) as never;
const two = [
  { id: "m1", label: "HT-5544" },
  { id: "m2", label: "HU-666" },
];

describe("moving machines to a group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMachineGroupsRequest).mockResolvedValue([group("g1", "North", 3), group("g2", "South", 1)]);
  });

  it("moves the ticked machines into the group picked, warning about access", async () => {
    vi.mocked(moveMachinesToGroupRequest).mockResolvedValue({ moved: 2, group: { id: "g2", name: "South" } });
    const onMoved = vi.fn();
    const onClose = vi.fn();
    render(<MoveToGroupDialog machines={two} onMoved={onMoved} onClose={onClose} />);

    const move = (await screen.findByRole("button", { name: "Move 2 machines" })) as HTMLButtonElement;
    expect(move.disabled).toBe(true);
    expect(screen.getByText("3 machines")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "South" }));
    expect(screen.getByRole("alert").textContent).toContain("stops seeing them");
    fireEvent.click(move);

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith("2 machines moved to South."));
    expect(moveMachinesToGroupRequest).toHaveBeenCalledWith("test-token", ["m1", "m2"], "g2");
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when the machine was already only in that group", async () => {
    vi.mocked(moveMachinesToGroupRequest).mockResolvedValue({ moved: 0, group: { id: "g1", name: "North" } });
    const onMoved = vi.fn();
    render(<MoveToGroupDialog machines={[two[0]]} onMoved={onMoved} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("radio", { name: "North" }));
    fireEvent.click(screen.getByRole("button", { name: "Move HT-5544" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith("HT-5544 was already only in North."));
  });

  it("filters the groups by name", async () => {
    render(<MoveToGroupDialog machines={two} onMoved={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole("radio", { name: "North" });
    fireEvent.change(screen.getByLabelText("Search groups"), { target: { value: "sou" } });
    expect(screen.queryByRole("radio", { name: "North" })).toBeNull();
    expect(screen.getByRole("radio", { name: "South" })).toBeTruthy();
  });

  it("shows the error and stays open when it fails", async () => {
    vi.mocked(moveMachinesToGroupRequest).mockRejectedValue(new ApiError("Machine not found.", 404));
    const onClose = vi.fn();
    render(<MoveToGroupDialog machines={two} onMoved={vi.fn()} onClose={onClose} />);

    fireEvent.click(await screen.findByRole("radio", { name: "North" }));
    fireEvent.click(screen.getByRole("button", { name: "Move 2 machines" }));
    await screen.findByText("Machine not found.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
