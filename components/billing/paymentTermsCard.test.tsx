import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentTermsCard } from "./paymentTermsCard";
import {
  applyForAccountRequest,
  redeemPromoCodeRequest,
  validatePromoCodeRequest,
} from "@/lib/api/paymentTermsApi";
import { ApiError } from "@/lib/api/httpClient";
import type { OrganisationPaymentTerms } from "@/lib/types/paymentTerms";

vi.mock("@/lib/api/paymentTermsApi", () => ({
  applyForAccountRequest: vi.fn(),
  choosePayByCardRequest: vi.fn(),
  setDefaultPoNumberRequest: vi.fn(),
  setInvoicePoNumberRequest: vi.fn(),
  validatePromoCodeRequest: vi.fn(),
  redeemPromoCodeRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));

const terms = (overrides: Partial<OrganisationPaymentTerms> = {}): OrganisationPaymentTerms => ({
  billingAccountId: "acct-1",
  timezone: "Australia/Brisbane",
  paymentType: "card",
  accountStatus: "none",
  usesAccountTerms: false,
  termsDays: 30,
  creditLimitCents: null,
  poRequired: false,
  defaultPoNumber: null,
  application: {
    legalName: null, abn: null, accountsEmail: null, accountsPhone: null, notes: null,
    appliedAt: null, approvedAt: null, approvalNotes: null, rejectedAt: null, rejectedReason: null,
  },
  freePeriod: null,
  promo: null,
  draftInvoice: null,
  ...overrides,
});

const onChanged = vi.fn();
const onAddCard = vi.fn();

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("how you pay", () => {
  it("offers card or a 30-day account and sends a complete application", async () => {
    vi.mocked(applyForAccountRequest).mockResolvedValue(terms({ accountStatus: "pending" }));
    render(<PaymentTermsCard terms={terms()} onChanged={onChanged} onAddCard={onAddCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay by card" }));
    expect(onAddCard).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply for a 30-day account" }));
    const send = screen.getByRole("button", { name: "Send application" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Legal company name"), { target: { value: "Acme Mining Pty Ltd" } });
    fireEvent.change(screen.getByLabelText("ABN"), { target: { value: "12 345 678 901" } });
    fireEvent.change(screen.getByLabelText("Accounts email"), { target: { value: "accounts@acme.test" } });
    fireEvent.change(screen.getByLabelText("Accounts phone"), { target: { value: "07 3000 0000" } });
    fireEvent.click(screen.getByLabelText("Our invoices need a purchase order (PO) number"));
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(applyForAccountRequest).toHaveBeenCalledWith("test-token", {
      legalName: "Acme Mining Pty Ltd",
      abn: "12345678901",
      accountsEmail: "accounts@acme.test",
      accountsPhone: "07 3000 0000",
      poRequired: true,
      notes: null,
    });
  });

  it("says a pending application blocks nothing", () => {
    render(<PaymentTermsCard terms={terms({ accountStatus: "pending" })} onChanged={onChanged} />);
    expect(screen.getByRole("status").textContent).toMatch(/Nothing is blocked/);
    expect(screen.queryByRole("button", { name: "Apply for a 30-day account" })).toBeNull();
  });

  it("asks a rejected organisation to add a card", () => {
    render(
      <PaymentTermsCard
        terms={terms({
          accountStatus: "rejected",
          application: { ...terms().application, rejectedReason: "Trading history too short." },
        })}
        onChanged={onChanged}
        onAddCard={onAddCard}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/Trading history too short\. Please add a card/);
    fireEvent.click(screen.getByRole("button", { name: "Add a card" }));
    expect(onAddCard).toHaveBeenCalled();
  });

  it("shows account terms, the free period badge and the PO fields", () => {
    render(
      <PaymentTermsCard
        terms={terms({
          paymentType: "account",
          accountStatus: "approved",
          usesAccountTerms: true,
          poRequired: true,
          application: { ...terms().application, accountsEmail: "accounts@acme.test" },
          freePeriod: { freeUntil: "2026-12-31", freePercent: 100, reason: "Pilot", setAt: null, active: true },
          draftInvoice: { id: "inv-1", periodStart: "2026-10-01", reviewUntil: null, poNumber: null },
        })}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText("Free until 31 December 2026")).toBeTruthy();
    expect(screen.getByText(/emailed to accounts@acme\.test with 30 days to pay by bank transfer/)).toBeTruthy();
    expect(screen.getByText(/Your invoices need a purchase order number/)).toBeTruthy();
    expect(screen.getByText("PO for October 2026")).toBeTruthy();
  });

  it("checks a promo code, then applies it", async () => {
    vi.mocked(validatePromoCodeRequest).mockResolvedValue({
      code: "SPRING25", description: "Spring", summary: "25% off machine charges for 3 months",
      discountType: "percent", discountValue: 25, startsMonth: "2026-11-01", endsMonth: "2027-01-01",
    });
    vi.mocked(redeemPromoCodeRequest).mockResolvedValue({} as never);
    render(<PaymentTermsCard terms={terms()} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText("Have a promo code?"), { target: { value: "spring25" } });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(await screen.findByText(/25% off machine charges for 3 months, November 2026 to January 2027/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply code" }));
    await waitFor(() => expect(redeemPromoCodeRequest).toHaveBeenCalledWith("test-token", "spring25"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows the API's clear reason when a code can't be used", async () => {
    vi.mocked(validatePromoCodeRequest).mockRejectedValue(new ApiError("That promo code has expired.", 422));
    render(<PaymentTermsCard terms={terms()} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText("Have a promo code?"), { target: { value: "OLD" } });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect((await screen.findByRole("alert")).textContent).toBe("That promo code has expired.");
    expect(redeemPromoCodeRequest).not.toHaveBeenCalled();
  });

  it("shows the promo already on the account instead of the form", () => {
    render(
      <PaymentTermsCard
        terms={terms({
          promo: {
            id: "r", promoCodeId: "p", code: "WELCOME", description: "", summary: "A$50.00 off machine charges every month",
            discountType: "fixed_cents", discountValue: 5000, billingAccountId: "acct-1", accountName: "Acme", redeemedAt: "", startsMonth: "2026-11-01", endsMonth: null,
          },
        })}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText(/A\$50\.00 off machine charges every month, from November 2026/)).toBeTruthy();
    expect(screen.queryByLabelText("Have a promo code?")).toBeNull();
  });
});
