import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addTabletRequest } from "@/lib/api/machineAppConnectionApi";
import { ConnectMachineAppDialog } from "./connectMachineAppDialog";

vi.mock("@/lib/api/machineAppConnectionApi", () => ({ addTabletRequest: vi.fn() }));

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { selector: "input" }), { target: { value } });
const submit = () => act(async () => void fireEvent.click(screen.getByRole("button", { name: "Add tablet" })));

describe("ConnectMachineAppDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("adds the tablet with its FIELD ID and password, then Continue moves on", async () => {
    vi.mocked(addTabletRequest).mockResolvedValue(undefined);
    const onConnected = vi.fn();
    render(<ConnectMachineAppDialog machineId="m1" machineLabel="ABC-01" onConnected={onConnected} onClose={vi.fn()} />);
    fill("FIELD ID", "482 915 307");
    fill("Password", "correct-horse");
    await submit();
    expect(addTabletRequest).toHaveBeenCalledWith("m1", "482915307", "correct-horse");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("shows why the tablet couldn't be added", async () => {
    const { ApiError } = await import("@/lib/api/httpClient");
    vi.mocked(addTabletRequest).mockRejectedValue(new ApiError("That FIELD ID or password isn't right.", 400));
    render(<ConnectMachineAppDialog machineId="m1" machineLabel="ABC-01" onConnected={vi.fn()} onClose={vi.fn()} />);
    fill("FIELD ID", "482915307");
    fill("Password", "wrong");
    await submit();
    expect(screen.getByRole("alert").textContent).toContain("isn't right");
  });
});
