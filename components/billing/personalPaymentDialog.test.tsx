import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalPaymentDialog } from "./personalPaymentDialog";
import { checkPersonalPayment, createPersonalPayment } from "@/lib/api/personalBillingApi";
import type { PersonalBillingStatus } from "@/lib/types/personalBilling";

vi.mock("@/lib/api/personalBillingApi", () => ({ createPersonalPayment: vi.fn(), checkPersonalPayment: vi.fn() }));
vi.mock("@/lib/auth/authSession", () => ({ getAccessToken: () => "test-token" }));
vi.mock("../shell/logoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));
const status: PersonalBillingStatus = {
  exempt: false, coveredByOrganisation: false, paymentRequired: true, monthlyCents: 4900, currency: "AUD",
  timezone: "Australia/Brisbane", periodStart: "2026-10-01", periodEnd: "2026-11-01",
  invoiceId: null, invoiceStatus: null, gstCents: null, totalCents: null, hostedInvoiceUrl: null,
};
const fillAddress = () => {
  fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "1 Example St" } });
  fireEvent.change(screen.getByLabelText("City / suburb"), { target: { value: "Brisbane" } });
  fireEvent.change(screen.getByLabelText("Postcode"), { target: { value: "4000" } });
};
const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("location", { ...window.location, assign });
  vi.mocked(checkPersonalPayment).mockResolvedValue({ ...status, paymentRequired: false });
});
afterEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe("personal payment confirmation", () => {
  it("shows the monthly amount, GST terms and billing period before confirming", () => {
    render(<PersonalPaymentDialog status={status} refresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm A$49.00 ex GST and pay" })).toBeTruthy();
    expect(screen.getByText(/no trial or proration/i)).toBeTruthy();
    expect(vi.mocked(createPersonalPayment)).not.toHaveBeenCalled();
  });

  it("sends only an address and sends the user to the secure payment page", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createPersonalPayment).mockResolvedValue({ ...status, paymentUrl: "https://invoice.stripe.com/i/test" });
    render(<PersonalPaymentDialog status={status} refresh={refresh} />);
    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: /Confirm A\$49/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://invoice.stripe.com/i/test"));
    expect(createPersonalPayment).toHaveBeenCalledWith("test-token", {
      line1: "1 Example St", city: "Brisbane", state: "QLD", postalCode: "4000", returnOrigin: window.location.origin,
    });
    expect(screen.getByRole("button", { name: "Opening secure Stripe payment…" })).toBeTruthy();
  });

  it("sends the user to Stripe Checkout, asking to come back to this portal", async () => {
    vi.mocked(createPersonalPayment).mockResolvedValue({ ...status, paymentUrl: "https://checkout.stripe.com/c/pay/test" });
    render(<PersonalPaymentDialog status={status} refresh={vi.fn()} />);
    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: /Confirm A\$49/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/test"));
    expect(vi.mocked(createPersonalPayment).mock.calls[0][1].returnOrigin).toBe(window.location.origin);
  });

  it("asks Stripe for the payment when the user says they have paid", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<PersonalPaymentDialog status={status} refresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "I’ve paid — check status" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(checkPersonalPayment).toHaveBeenCalledWith("test-token");
  });

  it("shows a retryable error and does not open an untrusted payment URL", async () => {
    vi.mocked(createPersonalPayment).mockResolvedValue({ ...status, paymentUrl: "https://example.com/phishing" });
    render(<PersonalPaymentDialog status={status} refresh={vi.fn()} />);
    fillAddress();
    fireEvent.click(screen.getByRole("button", { name: /Confirm A\$49/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be verified"));
    expect(assign).not.toHaveBeenCalled();
  });
});
