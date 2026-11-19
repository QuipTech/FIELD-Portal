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

const allowed = {
  canDelete: true,
  blocker: null,
  message: null,
  finalInvoiceFrom: null,
  unpaidInvoices: [],
  finalCharge: null,
  billing: "card" as const,
  bankTransferAvailable: false,
  bankTransfer: null,
};
const renderSection = () => render(<DeleteMachineSection machineId="m1" machineLabel="ABC-01" lifecycleState="registered" />);
const deleteButton = (name = "Delete machine") => screen.getAllByRole("button", { name }).at(-1) as HTMLButtonElement;

describe("deleting a machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteMachineRequest).mockResolvedValue(null);
  });

  it("lets a 30-day account delete without paying: the days go on its statement", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
      ...allowed,
      billing: "account",
      message: "The days this machine was used are billed on your next monthly statement from QuipTech accounts.",
    });
    renderSection();
    await screen.findByText(/next monthly statement/);
    expect(screen.getByText("Nothing to pay now. This machine can be deleted.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay online" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay by bank transfer" })).toBeNull();
    expect(deleteButton().disabled).toBe(false);
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
    const stuck = { id: "f1", periodStart: "2026-10-01", status: "draft", hostedInvoiceUrl: null, isFinalCharge: true, payByBankTransfer: false };
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

      fireEvent.click(await screen.findByRole("button", { name: "Pay online" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith(checkoutUrl));
      expect(payMachineFinalChargeRequest).toHaveBeenCalledWith("test-token", "m1", "http://localhost:3000");
    });

    it("refuses a payment link that isn't Stripe's", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(unpaid);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...unpaid, paymentUrl: "https://evil.example/pay" });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay online" }));
      await screen.findByText(/payment link could not be verified/);
      expect(assign).not.toHaveBeenCalled();
    });

    it("shows Stripe's error", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(unpaid);
      vi.mocked(payMachineFinalChargeRequest).mockRejectedValue(new ApiError("Billing is not configured (STRIPE_SECRET_KEY).", 503));
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay online" }));
      await screen.findByText("Billing is not configured (STRIPE_SECRET_KEY).");
      expect(assign).not.toHaveBeenCalled();
      expect(deleteButton().disabled).toBe(true);
    });

    it("goes nowhere if it was already paid", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValueOnce(unpaid).mockResolvedValue(allowed);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...allowed, paymentUrl: null });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay online" }));
      await screen.findByText(/Billing is settled/);
      expect(assign).not.toHaveBeenCalled();
      expect(deleteButton().disabled).toBe(false);
    });

    it("shows the total due, then goes to Checkout from Pay online", async () => {
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
          discounts: [],
          amountDueCents: 1607,
        },
      });
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...unpaid, paymentUrl: checkoutUrl });
      renderSection();

      await screen.findByText(/Amount due: .*16\.07/);
      expect(screen.getByText(/October 2026: 7 of 31 days, up to 31 October 2026/)).toBeTruthy();
      expect(screen.getByText(/November 2026: 7 of 30 days, up to 7 November 2026/)).toBeTruthy();
      expect(deleteButton().disabled).toBe(true);

      expect(screen.queryByRole("button", { name: "Pay by bank transfer" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Pay online" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith(checkoutUrl));
    });
  });

  it("takes the promo off the final charge", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
      ...allowed,
      canDelete: false,
      blocker: "final_charge_due",
      message: "Pay for the days this machine was used, then you can delete it.",
      finalCharge: {
        amountCents: 1607,
        months: [{ periodStart: "2026-11-01", lastUsedOn: "2026-11-07", daysUsed: 7, daysInMonth: 30, monthlyRateCents: 3500, amountCents: 1607 }],
        discounts: [{ description: "Promo HVJH6: 9% off", amountCents: -145 }],
        amountDueCents: 1462,
      },
    });
    renderSection();
    await screen.findByText(/Amount due: .*14\.62 \+ GST/);
    expect(screen.getByText(/Promo HVJH6: 9% off: −.*1\.45/)).toBeTruthy();
  });

  describe("paying by bank transfer", () => {
    const due = {
      ...allowed,
      canDelete: false,
      blocker: "final_charge_due" as const,
      message: "Pay for the days this machine was used, then you can delete it.",
      bankTransferAvailable: true,
      finalCharge: {
        amountCents: 1607,
        months: [{ periodStart: "2026-11-01", lastUsedOn: "2026-11-07", daysUsed: 7, daysInMonth: 30, monthlyRateCents: 3500, amountCents: 1607 }],
        discounts: [],
        amountDueCents: 1607,
      },
    };
    const awaiting = {
      ...allowed,
      canDelete: false,
      blocker: "unpaid_invoices" as const,
      message: "Your bank transfer is awaiting approval. You can delete this machine once your payment has been confirmed.",
      bankTransferAvailable: true,
      unpaidInvoices: [
        { id: "f1", periodStart: "2026-11-01", status: "synced", hostedInvoiceUrl: "https://invoice.stripe.com/i/f", isFinalCharge: true, payByBankTransfer: true },
      ],
      bankTransfer: { invoiceId: "f1", accountName: "QuipTech Pty Ltd", bsb: "064-000", accountNumber: "12345678", reference: "FIELD-F1AB" },
    };

    it("emails the invoice with bank details, then waits for approval before deleting", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue(due);
      vi.mocked(payMachineFinalChargeRequest).mockResolvedValue({ ...awaiting, paymentUrl: null });
      renderSection();

      fireEvent.click(await screen.findByRole("button", { name: "Pay by bank transfer" }));
      expect(screen.getByText(/email the invoice for .*16\.07 \+ GST/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Email invoice" }));

      await screen.findByText(/bank transfer is awaiting approval/);
      expect(payMachineFinalChargeRequest).toHaveBeenCalledWith("test-token", "m1", expect.any(String), "bank_transfer");
      expect(screen.getByText("064-000")).toBeTruthy();
      expect(screen.getByText("12345678")).toBeTruthy();
      expect(screen.getByText("FIELD-F1AB")).toBeTruthy();
      expect(screen.getByText("Bank transfer awaiting approval")).toBeTruthy();
      expect(deleteButton().disabled).toBe(true);
    });

    it("allows deleting once the payment is approved", async () => {
      vi.mocked(getMachineDeletionCheckRequest).mockResolvedValueOnce(awaiting).mockResolvedValue(allowed);
      renderSection();
      await screen.findByText(/bank transfer is awaiting approval/);
      expect(deleteButton().disabled).toBe(true);
      fireEvent.focus(window);
      await screen.findByText(/Billing is settled/);
      expect(deleteButton().disabled).toBe(false);
    });
  });

  it("links each unpaid invoice to its payment page, or to Billing", async () => {
    vi.mocked(getMachineDeletionCheckRequest).mockResolvedValue({
      ...allowed,
      canDelete: false,
      blocker: "unpaid_invoices",
      message: "Pay the invoices below to delete this machine.",
      unpaidInvoices: [
        { id: "i1", periodStart: "2026-10-01", status: "synced", hostedInvoiceUrl: "https://invoice.stripe.com/i/1", isFinalCharge: false, payByBankTransfer: false },
        { id: "i2", periodStart: "2026-11-01", status: "draft", hostedInvoiceUrl: null, isFinalCharge: false, payByBankTransfer: false },
      ],
    });
    renderSection();
    expect(((await screen.findByRole("link", { name: "Pay invoice" })) as HTMLAnchorElement).href).toBe("https://invoice.stripe.com/i/1");
    expect(screen.getByText("October 2026 invoice")).toBeTruthy();
    expect(screen.getByText("November 2026 invoice")).toBeTruthy();
    expect((screen.getByRole("link", { name: "View in Billing" }) as HTMLAnchorElement).getAttribute("href")).toBe("/settings/billing");
  });

  it("looks again on coming back from paying in another tab", async () => {
    const unpaid = { ...allowed, canDelete: false, blocker: "unpaid_invoices" as const, message: "Pay the invoices below.", unpaidInvoices: [{ id: "f1", periodStart: "2026-10-01", status: "synced", hostedInvoiceUrl: "https://invoice.stripe.com/i/f", isFinalCharge: true, payByBankTransfer: false }] };
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
