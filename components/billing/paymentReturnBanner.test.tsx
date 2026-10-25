import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentReturnBanner } from "./paymentReturnBanner";
import { checkPersonalPayment } from "@/lib/api/personalBillingApi";

vi.mock("@/lib/api/personalBillingApi", () => ({ checkPersonalPayment: vi.fn() }));
vi.mock("@/lib/auth/authSession", () => ({ getAccessToken: () => "test-token" }));

const returnWith = (query: string) => window.history.replaceState(null, "", `/settings/billing${query}`);
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("return from Stripe Checkout", () => {
  it("confirms the payment with Stripe and offers a way back into FIELD", async () => {
    returnWith("?payment=complete");
    vi.mocked(checkPersonalPayment).mockResolvedValue({} as Awaited<ReturnType<typeof checkPersonalPayment>>);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PaymentReturnBanner paymentRequired refresh={refresh} />);
    expect(screen.getByText("Confirming your payment with Stripe…")).toBeTruthy();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(checkPersonalPayment).toHaveBeenCalledWith("test-token");
    rerender(<PaymentReturnBanner paymentRequired={false} refresh={refresh} />);
    expect(screen.getByText("Payment received. Thank you!")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue to FIELD" }).getAttribute("href")).toBe("/dashboard");
  });

  it("tells the user nothing was charged when they cancel", () => {
    returnWith("?payment=cancelled");
    render(<PaymentReturnBanner paymentRequired refresh={vi.fn()} />);
    expect(screen.getByText(/You have not been charged/)).toBeTruthy();
    expect(checkPersonalPayment).not.toHaveBeenCalled();
  });

  it("shows nothing on an ordinary visit", () => {
    returnWith("");
    const { container } = render(<PaymentReturnBanner paymentRequired refresh={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
