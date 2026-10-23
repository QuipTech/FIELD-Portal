import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalPaymentPrompt } from "./personalPaymentPrompt";

const state = vi.hoisted(() => ({
  pathname: "/dashboard",
  billing: { status: null as null | { exempt: boolean; paymentRequired: boolean }, error: null as string | null, refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/lib/hooks/usePersonalBilling", () => ({ usePersonalBilling: () => state.billing }));
vi.mock("./personalPaymentDialog", () => ({ PersonalPaymentDialog: () => <div>Subscription payment required</div> }));
vi.mock("../shell/logoutButton", () => ({ LogoutButton: () => <button>Log out</button> }));

beforeEach(() => { state.pathname = "/dashboard"; state.billing.status = null; state.billing.error = null; });
afterEach(cleanup);

describe("subscription popup", () => {
  it("shows the popup for an unpaid non-owner on the homepage", () => {
    state.billing.status = { exempt: false, paymentRequired: true };
    render(<PersonalPaymentPrompt />);
    expect(screen.getByText("Subscription payment required")).toBeTruthy();
  });
  it.each(["/login", "/register", "/auth/callback", "/forgot-password/reset", "/verify-email", "/settings/billing"])(
    "does not cover the %s flow", (pathname) => {
      state.pathname = pathname;
      state.billing.status = { exempt: false, paymentRequired: true };
      render(<PersonalPaymentPrompt />);
      expect(screen.queryByText("Subscription payment required")).toBeNull();
    },
  );
  it.each([{ exempt: true, paymentRequired: false }, { exempt: false, paymentRequired: false }])(
    "does not prompt Owners or already-paid users", (status) => {
      state.billing.status = status;
      render(<PersonalPaymentPrompt />);
      expect(screen.queryByText("Subscription payment required")).toBeNull();
    },
  );
  it("shows a retry when billing cannot be checked", () => {
    state.billing.error = "Unable to check subscription";
    render(<PersonalPaymentPrompt />);
    expect(screen.getByRole("alert").textContent).toContain("Unable to check subscription");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
