import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkActivateDialog } from "./bulkActivateDialog";
import { applyBulkLifecycleActionRequest, getActivationQuoteRequest } from "@/lib/api/machineLifecycleApi";

vi.mock("@/lib/api/machineLifecycleApi", () => ({
  applyBulkLifecycleActionRequest: vi.fn(),
  getActivationQuoteRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

describe("bulk activation", () => {
  it("prices the selection, activates registered and reactivates archived machines", async () => {
    vi.mocked(getActivationQuoteRequest).mockResolvedValue({ pricing: "contract", timezone: "Australia/Brisbane", invoicedOn: "2026-11-01" });
    vi.mocked(applyBulkLifecycleActionRequest).mockImplementation(async (_token, ids) => ({
      applied: ids.map((id) => ({ machineId: id }) as never),
      failed: [],
    }));
    const onDone = vi.fn();
    render(
      <BulkActivateDialog
        machines={[{ id: "m1", lifecycleState: "registered" }, { id: "m2", lifecycleState: "archived" }]}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    expect(getActivationQuoteRequest).toHaveBeenCalledWith("test-token", 2);
    fireEvent.click(screen.getByRole("button", { name: "Activate 2 machines" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ activated: 2, failures: [] }));
    expect(applyBulkLifecycleActionRequest).toHaveBeenCalledWith("test-token", ["m1"], "activate");
    expect(applyBulkLifecycleActionRequest).toHaveBeenCalledWith("test-token", ["m2"], "reactivate");
  });
});
