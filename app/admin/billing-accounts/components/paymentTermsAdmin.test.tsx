import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountApplicationsPanel } from "./accountApplicationsPanel";
import { PromoCodesPanel } from "./promoCodesPanel";
import {
  approveApplicationRequest,
  createPromoCodeRequest,
  listAccountApplicationsRequest,
  listPromoCodesRequest,
  rejectApplicationRequest,
  setPromoCodeActiveRequest,
} from "@/lib/api/paymentTermsApi";
import type { AccountApplication, PromoCode } from "@/lib/types/paymentTerms";

vi.mock("@/lib/api/paymentTermsApi", () => ({
  listAccountApplicationsRequest: vi.fn(),
  approveApplicationRequest: vi.fn(),
  rejectApplicationRequest: vi.fn(),
  holdApplicationRequest: vi.fn(),
  listPromoCodesRequest: vi.fn(),
  createPromoCodeRequest: vi.fn(),
  updatePromoCodeRequest: vi.fn(),
  setPromoCodeActiveRequest: vi.fn(),
  listPromoRedemptionsRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));

const application = (overrides: Partial<AccountApplication> = {}): AccountApplication => ({
  billingAccountId: "acct-1",
  timezone: "Australia/Brisbane",
  paymentType: "card",
  accountStatus: "pending",
  usesAccountTerms: false,
  termsDays: 30,
  creditLimitCents: null,
  poRequired: true,
  defaultPoNumber: null,
  application: {
    legalName: "Acme Mining Pty Ltd", abn: "12345678901", accountsEmail: "accounts@acme.test", accountsPhone: "07 3000 0000",
    notes: null, appliedAt: "2026-11-10T00:00:00Z", approvedAt: null, approvalNotes: null, rejectedAt: null, rejectedReason: null,
  },
  freePeriod: null,
  accountName: "Acme Mining",
  billingEmail: "billing@acme.test",
  organisationNames: "Acme Mining",
  ...overrides,
});

const promo = (overrides: Partial<PromoCode> = {}): PromoCode => ({
  id: "promo-1", code: "SPRING25", description: "Spring offer", discountType: "percent", discountValue: 25,
  durationMonths: 3, validFrom: null, validUntil: "2026-12-31", maxRedemptions: 50, redemptionsCount: 4,
  newCustomersOnly: true, active: true, summary: "25% off machine charges for 3 months", createdAt: "", updatedAt: "",
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("account applications", () => {
  it("lists a pending application and approves it with terms and a credit limit", async () => {
    vi.mocked(listAccountApplicationsRequest).mockResolvedValue([application()]);
    vi.mocked(approveApplicationRequest).mockResolvedValue({} as never);
    render(<AccountApplicationsPanel />);
    expect(await screen.findByText("Acme Mining Pty Ltd")).toBeTruthy();
    expect(screen.getByText("PO required")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.change(screen.getByLabelText("Credit limit (A$, optional)"), { target: { value: "1,000" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve account" }));
    await waitFor(() =>
      expect(approveApplicationRequest).toHaveBeenCalledWith("test-token", "acct-1", {
        termsDays: 30,
        creditLimitCents: 100000,
        notes: null,
      }),
    );
    expect(await screen.findByText("Acme Mining now pays on a 30-day account.")).toBeTruthy();
  });

  it("rejects with a reason shown to the organisation", async () => {
    vi.mocked(listAccountApplicationsRequest).mockResolvedValue([application()]);
    vi.mocked(rejectApplicationRequest).mockResolvedValue({} as never);
    render(<AccountApplicationsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    fireEvent.change(screen.getByLabelText("Reason (shown to the organisation)"), { target: { value: "No trading history" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject application" }));
    await waitFor(() => expect(rejectApplicationRequest).toHaveBeenCalledWith("test-token", "acct-1", "No trading history"));
  });

  it("offers no decision on an approved account", async () => {
    vi.mocked(listAccountApplicationsRequest).mockResolvedValue([
      application({ accountStatus: "approved", paymentType: "account", usesAccountTerms: true }),
    ]);
    render(<AccountApplicationsPanel />);
    expect(await screen.findByText("Approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});

describe("promo codes", () => {
  it("lists codes with usage and deactivates one", async () => {
    vi.mocked(listPromoCodesRequest).mockResolvedValue([promo()]);
    vi.mocked(setPromoCodeActiveRequest).mockResolvedValue(promo({ active: false }));
    render(<PromoCodesPanel />);
    expect(await screen.findByText("SPRING25")).toBeTruthy();
    expect(screen.getByText(/used 4 of 50/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(setPromoCodeActiveRequest).toHaveBeenCalledWith("test-token", "promo-1", false));
  });

  it("creates a fixed-amount code in cents, forever, unlimited", async () => {
    vi.mocked(listPromoCodesRequest).mockResolvedValue([]);
    vi.mocked(createPromoCodeRequest).mockResolvedValue(promo({ code: "WELCOME50" }));
    render(<PromoCodesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "New promo code" }));
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "welcome50" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Welcome offer" } });
    fireEvent.change(screen.getByLabelText("Discount"), { target: { value: "fixed_cents" } });
    fireEvent.change(screen.getByLabelText("Amount (A$)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Create code" }));
    await waitFor(() =>
      expect(createPromoCodeRequest).toHaveBeenCalledWith("test-token", {
        code: "WELCOME50",
        description: "Welcome offer",
        discountType: "fixed_cents",
        discountValue: 5000,
        durationMonths: null,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        newCustomersOnly: false,
      }),
    );
  });

  it("won't create a percentage over 100", async () => {
    vi.mocked(listPromoCodesRequest).mockResolvedValue([]);
    render(<PromoCodesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "New promo code" }));
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "TOOMUCH" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Percent"), { target: { value: "150" } });
    expect((screen.getByRole("button", { name: "Create code" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
