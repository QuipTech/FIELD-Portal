import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/httpClient";
import { correctMachineIdentifiersRequest } from "@/lib/api/machineFleetApi";
import { EditIdentifierModal } from "./editIdentifierModal";

vi.mock("@/lib/api/machineFleetApi", () => ({ correctMachineIdentifiersRequest: vi.fn() }));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("editing a machine identifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(correctMachineIdentifiersRequest).mockResolvedValue({});
  });

  it("corrects the Plant ID with a reason", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<EditIdentifierModal machineId="m1" identifier="plantId" currentValue="DZ299" onSaved={onSaved} onClose={onClose} />);
    expect(save().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Plant ID"), { target: { value: " DZ300 " } });
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "Typo" } });
    fireEvent.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(correctMachineIdentifiersRequest).toHaveBeenCalledWith("test-token", "m1", { assetNumber: "DZ300", reason: "Typo" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clears a blank Plant ID", async () => {
    render(<EditIdentifierModal machineId="m1" identifier="plantId" currentValue="DZ299" onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Plant ID"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "Not used" } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(correctMachineIdentifiersRequest).toHaveBeenCalledWith("test-token", "m1", { assetNumber: null, reason: "Not used" }),
    );
  });

  it("won't save a blank serial", () => {
    render(<EditIdentifierModal machineId="m1" identifier="serialNumber" currentValue="ABC123" onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "Wrong" } });
    expect(screen.getByText("The serial number can't be blank.")).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it("shows a duplicate serial error and stays open", async () => {
    vi.mocked(correctMachineIdentifiersRequest).mockRejectedValue(
      new ApiError("Another machine in your organisation already has this serial number.", 409),
    );
    const onClose = vi.fn();
    render(<EditIdentifierModal machineId="m1" identifier="serialNumber" currentValue="ABC123" onSaved={vi.fn()} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "XYZ" } });
    fireEvent.change(screen.getByLabelText("Reason for the change"), { target: { value: "Wrong plate" } });
    fireEvent.click(save());
    await screen.findByText(/already has this serial number/);
    expect(onClose).not.toHaveBeenCalled();
  });
});
