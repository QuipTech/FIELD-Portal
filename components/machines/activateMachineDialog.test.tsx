import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivateMachineDialog } from "./activateMachineDialog";
import {
  applyLifecycleActionRequest,
  getActivationPromoRequest,
  getActivationQuoteRequest,
  redeemActivationPromoRequest,
  validateActivationPromoRequest,
} from "@/lib/api/machineLifecycleApi";

vi.mock("@/lib/api/machineLifecycleApi", () => ({
  applyLifecycleActionRequest: vi.fn(),
  getActivationQuoteRequest: vi.fn(),
  getActivationPromoRequest: vi.fn(),
  validateActivationPromoRequest: vi.fn(),
  redeemActivationPromoRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const QUOTE = {
  pricing: "per_machine" as const,
  term: "monthly" as const,
  committedQty: null,
  timezone: "Australia/Brisbane",
  invoicedOn: "2026-12-01",
  activeToday: 1,
  machinesAfter: 2,
  billableBefore: 1,
  billableAfter: 2,
  rateBeforeCents: 5000,
  rateAfterCents: 5000,
  monthlyBeforeCents: 5000,
  monthlyAfterCents: 10000,
  bands: [{ from: 1, to: null, unitCents: 5000 }],
};

const renderDialog = (onActivated = vi.fn()) =>
  render(
    <ActivateMachineDialog
      machineId="m1"
      machineLabel="Excavator"
      lifecycleState="registered"
      onActivated={onActivated}
      onClose={vi.fn()}
    />,
  );

describe("activating a machine with a promo code", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getActivationQuoteRequest).mockResolvedValue(QUOTE);
    vi.mocked(getActivationPromoRequest).mockResolvedValue(null);
  });

  it("shows the discount, then redeems the code before activating", async () => {
    vi.mocked(validateActivationPromoRequest).mockResolvedValue({
      code: "HVJH6", description: "Testing", summary: "9% off machine charges for 5 months",
      discountType: "percent", discountValue: 9, startsMonth: "2026-11-01", endsMonth: "2027-03-01",
    });
    const calls: string[] = [];
    vi.mocked(redeemActivationPromoRequest).mockImplementation(async () => {
      calls.push("redeem");
      return {} as never;
    });
    vi.mocked(applyLifecycleActionRequest).mockImplementation(async () => {
      calls.push("activate");
      return {} as never;
    });
    const onActivated = vi.fn();
    renderDialog(onActivated);

    fireEvent.change(await screen.findByLabelText("Have a promo code?"), { target: { value: "hvjh6" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Promo HVJH6")).toBeTruthy();
    expect(screen.getByText("−A$9.00")).toBeTruthy();
    expect(screen.getByText("A$91.00 ex GST")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Activate machine" }));
    await waitFor(() => expect(onActivated).toHaveBeenCalled());
    expect(redeemActivationPromoRequest).toHaveBeenCalledWith("test-token", "HVJH6");
    expect(calls).toEqual(["redeem", "activate"]);
  });

  it("doesn't activate when the code can't be redeemed", async () => {
    vi.mocked(validateActivationPromoRequest).mockResolvedValue({
      code: "HVJH6", description: "", summary: "9% off", discountType: "percent", discountValue: 9,
      startsMonth: "2026-11-01", endsMonth: null,
    });
    vi.mocked(redeemActivationPromoRequest).mockRejectedValue(new Error("That promo code has been fully used."));
    renderDialog();
    fireEvent.change(await screen.findByLabelText("Have a promo code?"), { target: { value: "HVJH6" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Promo HVJH6");
    fireEvent.click(screen.getByRole("button", { name: "Activate machine" }));
    await waitFor(() => expect(redeemActivationPromoRequest).toHaveBeenCalled());
    expect(applyLifecycleActionRequest).not.toHaveBeenCalled();
  });

  it("shows the promo already on the account, with no code box", async () => {
    vi.mocked(getActivationPromoRequest).mockResolvedValue({
      id: "r", promoCodeId: "p", code: "WELCOME", description: "", summary: "A$20.00 off machine charges every month",
      discountType: "fixed_cents", discountValue: 2000, billingAccountId: "a", accountName: "Acme", redeemedAt: "",
      startsMonth: "2026-11-01", endsMonth: null,
    });
    renderDialog();
    expect(await screen.findByText("Promo WELCOME")).toBeTruthy();
    expect(screen.getByText("−A$20.00")).toBeTruthy();
    expect(screen.queryByLabelText("Have a promo code?")).toBeNull();
  });

});
