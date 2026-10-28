import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransfersView } from "./transfersView";
import { decideTransferRequest, listTransfersRequest } from "@/lib/api/machineLifecycleApi";

vi.mock("@/lib/api/machineLifecycleApi", () => ({ listTransfersRequest: vi.fn(), decideTransferRequest: vi.fn() }));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
vi.mock("@/lib/auth/useSignedInProfile", () => ({ useSignedInProfile: () => ({ tenant: { slug: "pit-crew" } }) }));
afterEach(cleanup);

describe("machine transfers", () => {
  it("shows the organisation ID to share and approves an incoming transfer", async () => {
    vi.mocked(listTransfersRequest).mockResolvedValue([
      {
        id: "tr1", machineId: "m1", machine: { label: "HT-220", serialNumber: "SN1", manufacturer: "CAT", model: "793F" },
        fromOrganisation: { id: "o1", name: "Red Edge" }, toOrganisation: { id: "o2", name: "Pit Crew" },
        status: "requested", reason: "Sold", requestedAt: "2026-10-20T00:00:00Z", decidedAt: null, decisionNote: null,
      },
    ]);
    vi.mocked(decideTransferRequest).mockResolvedValue({} as never);
    render(<TransfersView />);
    expect(screen.getByText("pit-crew")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve and receive machine" }));
    await waitFor(() => expect(decideTransferRequest).toHaveBeenCalledWith("test-token", "tr1", "approve", undefined));
  });
});
