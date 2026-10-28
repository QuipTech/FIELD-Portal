import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicesOverview } from "./invoicesOverview";
import { listAdminInvoicesRequest, refreshInvoicesFromStripeRequest } from "@/lib/api/adminInvoicesApi";
import type { AdminInvoiceList } from "@/lib/types/adminInvoice";

vi.mock("@/lib/api/adminInvoicesApi", () => ({ listAdminInvoicesRequest: vi.fn(), refreshInvoicesFromStripeRequest: vi.fn() }));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));

const empty = { count: 0, totalCents: 0, paidCents: 0 };
const list: AdminInvoiceList = {
  total: 2, page: 1, pageSize: 25,
  summary: {
    paid: { count: 1, totalCents: 5390, paidCents: 5390 }, unpaid: { count: 1, totalCents: 4900, paidCents: 0 },
    failed: empty, pending: empty, refunded: empty, void: empty,
  },
  items: [
    { id: "a", category: "paid", status: "paid", kind: "personal", payerEmail: "farhan@example.com", payerName: "Farhan F", organisationName: "Quiptech",
      periodStart: "2026-10-01", totalExGstCents: 4900, gstCents: 490, totalCents: 5390, amountPaidCents: 5390, amountRefundedCents: 0,
      stripeInvoiceId: "in_a", hostedInvoiceUrl: "https://invoice.stripe.com/i/a", createdAt: "", updatedAt: "", invoiceKind: "personal", reviewUntil: null, heldAt: null, amountCreditedCents: 0, dueOn: null },
    { id: "b", category: "unpaid", status: "synced", kind: "personal", payerEmail: "uneeb@example.com", payerName: "Uneeb M", organisationName: "Tovo solution",
      periodStart: "2026-10-01", totalExGstCents: 4900, gstCents: null, totalCents: null, amountPaidCents: 0, amountRefundedCents: 0,
      stripeInvoiceId: "in_b", hostedInvoiceUrl: null, createdAt: "", updatedAt: "", invoiceKind: "personal", reviewUntil: null, heldAt: null, amountCreditedCents: 0, dueOn: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAdminInvoicesRequest).mockResolvedValue(list);
});
afterEach(cleanup);

describe("admin invoices overview", () => {
  it("shows every user's invoice with its payment status and the money summary", async () => {
    render(<InvoicesOverview />);
    expect(await screen.findByText("Farhan F")).toBeTruthy();
    expect(screen.getByText("uneeb@example.com")).toBeTruthy();
    expect(screen.getByText("A$49.00 + GST")).toBeTruthy();
    expect(screen.getAllByText("A$53.90").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Unpaid · 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Void/ })).toBeNull();
  });

  it("filters by payment status", async () => {
    render(<InvoicesOverview />);
    fireEvent.click(await screen.findByRole("button", { name: "Unpaid · 1" }));
    await waitFor(() => expect(listAdminInvoicesRequest).toHaveBeenLastCalledWith("test-token", expect.objectContaining({ category: "unpaid", page: 1 })));
  });

  it("refreshes unpaid invoices from Stripe and reloads the list", async () => {
    vi.mocked(refreshInvoicesFromStripeRequest).mockResolvedValue({ checked: 2, updated: 1, failed: 0 });
    render(<InvoicesOverview />);
    await screen.findByText("Farhan F");
    const loads = vi.mocked(listAdminInvoicesRequest).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Refresh from Stripe/ }));
    expect(await screen.findByText("Checked 2 unpaid invoices with Stripe: 1 newly paid.")).toBeTruthy();
    await waitFor(() => expect(vi.mocked(listAdminInvoicesRequest).mock.calls.length).toBeGreaterThan(loads));
  });
});
