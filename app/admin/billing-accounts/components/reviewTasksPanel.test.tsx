import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewTasksPanel } from "./reviewTasksPanel";
import { listReviewTasksRequest, updateReviewTaskRequest } from "@/lib/api/adminBillingOperationsApi";

vi.mock("@/lib/api/adminBillingOperationsApi", () => ({
  listReviewTasksRequest: vi.fn(),
  updateReviewTaskRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

describe("review tasks", () => {
  it("resolves a plan review with notes", async () => {
    vi.mocked(listReviewTasksRequest).mockResolvedValue([
      {
        id: "t1", billingAccountId: "a", accountName: "Pit Crew", type: "plan_review",
        reason: "AI assistant use was over the monthly allowance for 2 months in a row.",
        status: "open", notes: null, details: {}, resolvedAt: null, createdAt: "2026-10-01T00:00:00Z",
      },
    ]);
    vi.mocked(updateReviewTaskRequest).mockResolvedValue({});
    render(<ReviewTasksPanel />);
    expect(await screen.findByText(/over the monthly allowance for 2 months/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Moved to annual" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Resolve" }).at(-1)!);
    await waitFor(() =>
      expect(updateReviewTaskRequest).toHaveBeenCalledWith("test-token", "t1", { status: "resolved", notes: "Moved to annual" }),
    );
  });
});
