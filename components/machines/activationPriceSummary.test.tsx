import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivationPriceSummary } from "./activationPriceSummary";
import { getActivationQuoteRequest } from "@/lib/api/machineLifecycleApi";
import type { ActivationQuote } from "@/lib/types/machineLifecycle";

vi.mock("@/lib/api/machineLifecycleApi", () => ({ getActivationQuoteRequest: vi.fn() }));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
afterEach(cleanup);

const bands = [{ from: 1, to: 25, unitCents: 3500 }, { from: 26, to: 99, unitCents: 2900 }, { from: 100, to: null, unitCents: 2500 }];
const quote = (fields: Partial<Extract<ActivationQuote, { pricing: "per_machine" }>>): ActivationQuote => ({
  pricing: "per_machine", term: "monthly", committedQty: null, timezone: "Australia/Brisbane", invoicedOn: "2026-11-01",
  activeToday: 2, machinesAfter: 3, billableBefore: 2, billableAfter: 3, rateBeforeCents: 3500, rateAfterCents: 3500,
  monthlyBeforeCents: 7000, monthlyAfterCents: 10500, bands, ...fields,
});

describe("activation price summary", () => {
  it("shows the machine price, the new monthly charge and when it is invoiced", async () => {
    vi.mocked(getActivationQuoteRequest).mockResolvedValue(quote({}));
    render(<ActivationPriceSummary />);
    expect(await screen.findByText("A$35.00 / month ex GST")).toBeTruthy();
    expect(screen.getByText("2 → 3")).toBeTruthy();
    expect(screen.getByText("A$70.00 → A$105.00 ex GST")).toBeTruthy();
    expect(screen.getByText(/invoiced on 1 November 2026/)).toBeTruthy();
    expect(screen.getByText(/No payment is taken now/)).toBeTruthy();
  });

  it("explains when crossing a band lowers every machine's rate", async () => {
    vi.mocked(getActivationQuoteRequest).mockResolvedValue(quote({
      activeToday: 25, machinesAfter: 26, billableBefore: 25, billableAfter: 26, rateAfterCents: 2900,
      monthlyBeforeCents: 87500, monthlyAfterCents: 75400,
    }));
    render(<ActivationPriceSummary />);
    expect(await screen.findByText(/moves to the A\$29.00 band/)).toBeTruthy();
  });

  it("says a contract covers the machine", async () => {
    vi.mocked(getActivationQuoteRequest).mockResolvedValue({ pricing: "contract", timezone: "Australia/Brisbane", invoicedOn: "2026-11-01" });
    render(<ActivationPriceSummary />);
    expect(await screen.findByText(/covered by your organisation's contract/)).toBeTruthy();
  });
});
