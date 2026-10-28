import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationBillingView } from "./organisationBillingView";
import {
  chooseNextTermRequest,
  getAnnualQuoteRequest,
  getOrganisationBillingRequest,
  keepPlanRequest,
  listOrganisationInvoicesRequest,
} from "@/lib/api/organisationBillingApi";
import type { OrganisationBillingSummary } from "@/lib/types/organisationBilling";

vi.mock("@/lib/api/organisationBillingApi", () => ({
  getOrganisationBillingRequest: vi.fn(),
  listOrganisationInvoicesRequest: vi.fn(),
  getAnnualQuoteRequest: vi.fn(),
  chooseNextTermRequest: vi.fn(),
  cancelPlanRequest: vi.fn(),
  keepPlanRequest: vi.fn(),
  createOrganisationPortalSessionRequest: vi.fn(),
  getOrganisationInvoicePdfRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));

const bands = [
  { bandNo: 1, lowerQty: 1, upperQty: 25, unitCents: 3500 },
  { bandNo: 2, lowerQty: 26, upperQty: 99, unitCents: 2900 },
  { bandNo: 3, lowerQty: 100, upperQty: null, unitCents: 2500 },
];
const summary = (overrides: Partial<OrganisationBillingSummary> = {}): OrganisationBillingSummary => ({
  account: { id: "a", name: "Pit Crew", billingEmail: "admin@pit.test", timezone: "Australia/Brisbane", suspendedAt: null, hasStripeCustomer: true },
  plan: {
    id: "s", planCode: "ASSET_PRO", planName: "FIELD Asset Professional", term: "monthly", status: "active",
    committedQty: null, annualMonthsCharged: null, currentPeriodStart: "2026-10-01", currentPeriodEnd: "2026-11-01",
    cancelAt: null, exportUntil: null, deleteAfter: null, nextTerm: null, nextCommittedQty: null,
    priceBookVersion: 1, unitCents: null, bands,
  },
  thisMonth: { periodStart: "2026-10-01", invoicedOn: "2026-11-01", activeToday: 3, peakSoFar: 3, rateCents: 3500, estimateCents: 10500 },
  overdue: { count: 0, amountCents: 0, firstNoticeAt: null, suspensionFrom: null },
  allowance: [{ metric: "ai_turns", allowance: 300, used: 270, thresholdState: "notified" }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listOrganisationInvoicesRequest).mockResolvedValue([]);
});
afterEach(cleanup);

describe("organisation billing", () => {
  it("shows the plan, this month's charge so far and fair use", async () => {
    vi.mocked(getOrganisationBillingRequest).mockResolvedValue(summary());
    render(<OrganisationBillingView />);
    expect(await screen.findByText("FIELD Asset Professional")).toBeTruthy();
    expect(screen.getByText("A$105.00")).toBeTruthy();
    expect(screen.getByText(/1–25 A\$35.00 · 26–99 A\$29.00 · 100\+ A\$25.00/)).toBeTruthy();
    expect(screen.getByText("270 questions of 300 questions")).toBeTruthy();
  });

  it("warns about overdue invoices before suspension", async () => {
    vi.mocked(getOrganisationBillingRequest).mockResolvedValue(
      summary({ overdue: { count: 1, amountCents: 5390, firstNoticeAt: "2026-10-15T00:00:00Z", suspensionFrom: "2026-10-29T00:00:00Z" } }),
    );
    render(<OrganisationBillingView />);
    expect((await screen.findByRole("alert")).textContent).toContain("may be paused from 29 October 2026");
  });

  it("prices an annual commitment and saves it for the next renewal", async () => {
    vi.mocked(getOrganisationBillingRequest).mockResolvedValue(summary());
    vi.mocked(getAnnualQuoteRequest).mockResolvedValue({
      committedQty: 15, monthlyPriceCents: 52500, monthsCharged: 10, upFrontCents: 525000, priceBookId: "b", priceBookVersion: 1,
    });
    vi.mocked(chooseNextTermRequest).mockResolvedValue({} as never);
    render(<OrganisationBillingView />);
    fireEvent.click(await screen.findByRole("button", { name: "Switch to annual (2 months free)" }));
    fireEvent.change(screen.getByLabelText("Machines to commit to"), { target: { value: "15" } });
    expect(await screen.findByText("A$5,250.00 ex GST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch at renewal" }));
    await waitFor(() => expect(chooseNextTermRequest).toHaveBeenCalledWith("test-token", { term: "annual", committedQty: 15 }));
  });

  it("lets a cancelling plan be kept", async () => {
    vi.mocked(getOrganisationBillingRequest).mockResolvedValue(
      summary({ plan: { ...summary().plan!, status: "cancelling", cancelAt: "2026-11-01", exportUntil: "2026-12-01" } }),
    );
    vi.mocked(keepPlanRequest).mockResolvedValue({} as never);
    render(<OrganisationBillingView />);
    expect(await screen.findByText("Ends 1 November 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep my plan" }));
    await waitFor(() => expect(keepPlanRequest).toHaveBeenCalled());
  });
});
