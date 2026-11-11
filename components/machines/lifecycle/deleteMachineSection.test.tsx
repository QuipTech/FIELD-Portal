import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteMachineSection } from "./deleteMachineSection";
import { ApiError } from "@/lib/api/httpClient";
import { deleteMachineRequest, getMachineDeletionCheckRequest, payMachineFinalChargeRequest } from "@/lib/api/machineLifecycleApi";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/machineLifecycleApi", () => ({
  deleteMachineRequest: vi.fn(),
  getMachineDeletionCheckRequest: vi.fn(),
  payMachineFinalChargeRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const allowed = { canDelete: true, blocker: null, message: null, finalInvoiceFrom: null, unpaidInvoices: [], finalCharge: null };
const renderSection = () => render(<DeleteMachineSection machineId="m1" machineLabel="ABC-01" lifecycleState="registered" />);
const deleteButton = (name = "Delete machine") => screen.getAllByRole("button", { name }).at(-1) as HTMLButtonElement;

describe("deleting a machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteMachineRequest).mockResolvedValue(null);
  });

  it("explains why it's blocked and when the final invoice comes", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
      ...allowed,
      canDelete: false,
      blocker: "awaiting_final_invoice",
      message: "This machine is still billed for this month.",
      finalInvoiceFrom: "2026-12-01",
    });
    renderSection();
    await screen.findByText("This machine is still billed for this month.");
    expect(screen.getByText(/1 December 2026/)).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
  });

  describe("paying the final charge", () => {
    const stuck = { id: "f1", periodStart: "2026-10-01", status: "draft", hostedInvoiceUrl: null, isFinalCharge: true };
    const unpaid = { ...allowed, canDelete: false, blocker: "unpaid_invoices" as const, message: "Pay the invoices below.", unpaidInvoices: [stuck] };
    const checkoutUrl = "https://checkout.stripe.com/c/pay/final";
    const assign = vi.fn();

    beforeEach(() => {
      assign.mockClear();
      vi.stubGlobal("location", { ...window.location, origin: "http://localhost:3000", assign });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("goes to Stripe Checkout for an invoice not paid yet", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(unpaid);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...unpaid, paymentUrl: checkoutUrl });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay invoice" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith(checkoutUrl));
      expect(payMachineFinalChargeRequest).toHaveBeenCalledWith("test-token", "m1", "http://localhost:3000");
    });

    it("refuses a payment link that isn't Stripe's", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(unpaid);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...unpaid, paymentUrl: "https://evil.example/pay" });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay invoice" }));
      await screen.findByText(/payment link could not be verified/);
      expect(assign).not.toHaveBeenCalled();
    });

    it("shows Stripe's error", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(unpaid);
      vi.mocked(payMachineFinalChargeRequest).mockRejectedValue(new ApiError("Billing is not configured (STRIPE_SECRET_KEY).", 503));
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay invoice" }));
      await screen.findByText("Billing is not configured (STRIPE_SECRET_KEY).");
      expect(assign).not.toHaveBeenCalled();
      expect(deleteButton().disabled).toBe(true);
    });

    it("goes nowhere if it was already paid", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValueOnce(unpaid).mockResolvedValue(allowed);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...allowed, paymentUrl: null });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay invoice" }));
      await screen.findByText(/Billing is settled/);
      expect(assign).not.toHaveBeenCalled();
      expect(deleteButton().disabled).toBe(false);
    });

    it("shows the total due, then goes to Checkout from Pay dues", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
        ...allowed,
        canDelete: false,
        blocker: "final_charge_due",
        message: "Pay for the days this machine was used, then you can delete it.",
        finalCharge: {
          amountCents: 1607,
          months: [
            { periodStart: "2026-10-01", lastUsedOn: "2026-10-31", daysUsed: 7, daysInMonth: 31, monthlyRateCents: 3500, amountCents: 790 },
            { periodStart: "2026-11-01", lastUsedOn: "2026-11-07", daysUsed: 7, daysInMonth: 30, monthlyRateCents: 3500, amountCents: 817 },
          ],
        },
      });
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...unpaid, paymentUrl: checkoutUrl });
      renderSection();

      await screen.findByText(/Amount due: .*16\.07/);
      expect(screen.getByText(/October 2026: 7 of 31 days, up to 31 October 2026/)).toBeTruthy();
      expect(screen.getByText(/November 2026: 7 of 30 days, up to 7 November 2026/)).toBeTruthy();
      expect(deleteButton().disabled).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Pay dues" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith(checkoutUrl));
    });
  });

  it("links each unpaid invoice to its payment page, or to Billing", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
      ...allowed,
      canDelete: false,
      blocker: "unpaid_invoices",
      message: "Pay the invoices below to delete this machine.",
      unpaidInvoices: [
        { id: "i1", periodStart: "2026-10-01", status: "synced", hostedInvoiceUrl: "https://invoice.stripe.com/i/1", isFinalCharge: false },
        { id: "i2", periodStart: "2026-11-01", status: "draft", hostedInvoiceUrl: null, isFinalCharge: false },
      ],
    });
    renderSection();
    expect(((await screen.findByRole("link", { name: "Pay invoice" })) as HTMLAnchorElement).href).toBe("https://invoice.stripe.com/i/1");
    expect(screen.getByText("October 2026 invoice")).toBeTruthy();
    expect(screen.getByText("November 2026 invoice")).toBeTruthy();
    expect((screen.getByRole("link", { name: "View in Billing" }) as HTMLAnchorElement).getAttribute("href")).toBe("/settings/billing");
  });

  it("looks again on coming back from paying in another tab", async () => {
    const unpaid = { ...allowed, canDelete: false, blocker: "unpaid_invoices" as const, message: "Pay the invoices below.", unpaidInvoices: [{ id: "f1", periodStart: "2026-10-01", status: "synced", hostedInvoiceUrl: "https://invoice.stripe.com/i/f", isFinalCharge: true }] };
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValueOnce(unpaid).mockResolvedValue(allowed);
    renderSection();
    await screen.findByRole("link", { name: "Pay invoice" });
    fireEvent.focus(window);
    await screen.findByText(/Billing is settled/);
    expect(deleteButton().disabled).toBe(false);
  });

  it("needs the machine's name and a reason, then deletes and leaves the page", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(allowed);
    renderSection();
    await screen.findByText(/Billing is settled/);
    fireEvent.click(deleteButton());
    const confirm = deleteButton();
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Machine name"), { target: { value: "ABC-01" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Scrapped" } });
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/machines"));
    expect(deleteMachineRequest).toHaveBeenCalledWith("test-token", "m1", "Scrapped");
  });
});
