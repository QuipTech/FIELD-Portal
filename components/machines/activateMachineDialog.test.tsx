import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivateMachineDialog } from "./activateMachineDialog";
import { applyLifecycleActionRequest, getActivationQuoteRequest } from "@/lib/api/machineLifecycleApi";
import { getPaymentTermsRequest, redeemPromoCodeRequest, validatePromoCodeRequest } from "@/lib/api/paymentTermsApi";
import { usePermissions } from "@/lib/auth/usePermissions";

vi.mock("@/lib/api/machineLifecycleApi", () => ({
  applyLifecycleActionRequest: vi.fn(),
  getActivationQuoteRequest: vi.fn(),
}));
vi.mock("@/lib/api/paymentTermsApi", () => ({
  getPaymentTermsRequest: vi.fn(),
  redeemPromoCodeRequest: vi.fn(),
  validatePromoCodeRequest: vi.fn(),
}));
vi.mock("@/lib/auth/usePermissions", () => ({ usePermissions: vi.fn() }));
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
    vi.mocked(getPaymentTermsRequest).mockResolvedValue({ promo: null } as never);
    vi.mocked(usePermissions).mockReturnValue({ isLoaded: true, can: () => true, machineControlEnabled: false });
  });

  it("shows the discount, then redeems the code before activating", async () => {
    vi.mocked(validatePromoCodeRequest).mockResolvedValue({
      code: "HVJH6", description: "Testing", summary: "9% off machine charges for 5 months",
      discountType: "percent", discountValue: 9, startsMonth: "2026-11-01", endsMonth: "2027-03-01",
    });
    const calls: string[] = [];
    vi.mocked(redeemPromoCodeRequest).mockImplementation(async () => {
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
    expect(redeemPromoCodeRequest).toHaveBeenCalledWith("test-token", "HVJH6");
    expect(calls).toEqual(["redeem", "activate"]);
  });

  it("doesn't activate when the code can't be redeemed", async () => {
    vi.mocked(validatePromoCodeRequest).mockResolvedValue({
      code: "HVJH6", description: "", summary: "9% off", discountType: "percent", discountValue: 9,
      startsMonth: "2026-11-01", endsMonth: null,
    });
    vi.mocked(redeemPromoCodeRequest).mockRejectedValue(new Error("That promo code has been fully used."));
    renderDialog();
    fireEvent.change(await screen.findByLabelText("Have a promo code?"), { target: { value: "HVJH6" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Promo HVJH6");
    fireEvent.click(screen.getByRole("button", { name: "Activate machine" }));
    await waitFor(() => expect(redeemPromoCodeRequest).toHaveBeenCalled());
    expect(applyLifecycleActionRequest).not.toHaveBeenCalled();
  });

  it("shows the promo already on the account, with no code box", async () => {
    vi.mocked(getPaymentTermsRequest).mockResolvedValue({
      promo: {
        id: "r", promoCodeId: "p", code: "WELCOME", description: "", summary: "A$20.00 off machine charges every month",
        discountType: "fixed_cents", discountValue: 2000, billingAccountId: "a", accountName: "Acme", redeemedAt: "",
        startsMonth: "2026-11-01", endsMonth: null,
      },
    } as never);
    renderDialog();
    expect(await screen.findByText("Promo WELCOME")).toBeTruthy();
    expect(screen.getByText("−A$20.00")).toBeTruthy();
    expect(screen.queryByLabelText("Have a promo code?")).toBeNull();
  });

  it("offers no promo box without billing.manage", async () => {
    vi.mocked(usePermissions).mockReturnValue({ isLoaded: true, can: () => false, machineControlEnabled: false });
    renderDialog();
    await screen.findByText("Price per machine");
    expect(screen.queryByLabelText("Have a promo code?")).toBeNull();
    expect(getPaymentTermsRequest).not.toHaveBeenCalled();
  });
});
