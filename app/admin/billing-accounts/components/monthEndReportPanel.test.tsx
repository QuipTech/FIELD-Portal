import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthEndReportPanel } from "./monthEndReportPanel";
import {
  exportMonthEndRequest,
  getMonthEndReportRequest,
  getStatementMachinesRequest,
  markMonthReadyRequest,
  markStatementPaidRequest,
  setZohoInvoiceRequest,
} from "@/lib/api/statementsApi";
import type { MonthEndReport, MonthEndReportRow } from "@/lib/types/billingStatement";

vi.mock("@/lib/api/statementsApi", () => ({
  exportMonthEndRequest: vi.fn(),
  getMonthEndReportRequest: vi.fn(),
  getStatementMachinesRequest: vi.fn(),
  markMonthReadyRequest: vi.fn(),
  markStatementPaidRequest: vi.fn(),
  setZohoInvoiceRequest: vi.fn(),
}));
vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));
vi.mock("@/lib/format/saveBlobAsFile", () => ({ saveBlobAsFile: vi.fn() }));
afterEach(cleanup);

const row = (overrides: Partial<MonthEndReportRow> = {}): MonthEndReportRow => ({
  statementId: "st-1",
  reference: "FLD-2026-10-0001",
  billingAccountId: "acct-1",
  organisationName: "Acme",
  legalName: "Acme Mining Pty Ltd",
  abn: "12345678901",
  accountsEmail: "accounts@acme.test",
  poNumber: "PO-77",
  paymentType: "account",
  billingMonth: "2026-10-01",
  promoCode: "SPRING",
  peakActiveMachines: 20,
  rateBand: "11–50",
  unitPriceCents: 3500,
  machineChargeCents: 70000,
  freePeriodDiscountCents: 0,
  promoDiscountCents: -14000,
  otherChargesCents: 0,
  subtotalExGstCents: 56000,
  gstCents: 5600,
  totalIncGstCents: 61600,
  status: "ready",
  termsDays: 30,
  zohoInvoiceNumber: null,
  zohoInvoiceDate: null,
  dueOn: null,
  paidOn: null,
  paidReference: null,
  daysOverdue: null,
  lines: [{ lineType: "ASSET_PRO", description: "Machines, peak 20", quantity: 20, unitCents: 3500, amountCents: 70000 }],
  ...overrides,
});

const report = (rows: MonthEndReportRow[], locked = false): MonthEndReport => ({
  month: "2026-10-01",
  locked,
  lockedAt: locked ? "2026-11-02T00:00:00Z" : null,
  rows,
  totals: rows.reduce(
    (sum, item) => ({
      subtotalExGstCents: sum.subtotalExGstCents + item.subtotalExGstCents,
      gstCents: sum.gstCents + item.gstCents,
      totalIncGstCents: sum.totalIncGstCents + item.totalIncGstCents,
    }),
    { subtotalExGstCents: 0, gstCents: 0, totalIncGstCents: 0 },
  ),
});

describe("month-end report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMonthEndReportRequest).mockResolvedValue(report([row()]));
  });

  it("shows one row per account for 30-day accounts by default, with totals", async () => {
    render(<MonthEndReportPanel />);
    await screen.findByText("Acme");
    expect(getMonthEndReportRequest).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ paymentType: "account", status: "all" }),
    );
    expect(screen.getByText(/Acme Mining Pty Ltd · ABN 12345678901/)).toBeTruthy();
    expect(screen.getByText("SPRING −A$140.00")).toBeTruthy();
    expect(screen.getByText(/1 statement · A\$560\.00 ex GST/)).toBeTruthy();
  });

  it("expands a row to its lines and machines", async () => {
    vi.mocked(getStatementMachinesRequest).mockResolvedValue([
      { machineId: "m1", plantId: "EX-07", manufacturer: "Komatsu", model: "PC210", serialNumber: "SN1", activeDays: 31, deleted: false },
    ]);
    render(<MonthEndReportPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Acme/ }));
    expect(await screen.findByText("EX-07")).toBeTruthy();
    expect(screen.getByText("Komatsu PC210")).toBeTruthy();
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.getByText("Machines, peak 20")).toBeTruthy();
  });

  it("exports CSV, Excel and the Zoho import", async () => {
    vi.mocked(exportMonthEndRequest).mockResolvedValue({ blob: new Blob(["x"]), fileName: "f.csv" });
    render(<MonthEndReportPanel />);
    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(exportMonthEndRequest).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(exportMonthEndRequest).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Zoho import (CSV)" }));
    await waitFor(() => expect(exportMonthEndRequest).toHaveBeenCalledTimes(3));
    const formats = vi.mocked(exportMonthEndRequest).mock.calls.map((call) => call[2]);
    expect(formats).toEqual(["csv", "xlsx", "zoho"]);
    expect(vi.mocked(exportMonthEndRequest).mock.calls[2][3]).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("marks the month as ready after confirming", async () => {
    vi.mocked(markMonthReadyRequest).mockResolvedValue({ month: "2026-10-01", lockedCount: 4 });
    render(<MonthEndReportPanel />);
    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Mark month as ready" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark as ready" }));
    await waitFor(() => expect(markMonthReadyRequest).toHaveBeenCalled());
    expect(await screen.findByText(/4 statements locked/)).toBeTruthy();
  });

  it("can't mark a locked month again", async () => {
    vi.mocked(getMonthEndReportRequest).mockResolvedValue(report([row()], true));
    render(<MonthEndReportPanel />);
    const button = (await screen.findByRole("button", { name: "Month is ready" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("enters the Zoho invoice for a ready statement", async () => {
    vi.mocked(setZohoInvoiceRequest).mockResolvedValue(row({ status: "invoiced_external" }));
    render(<MonthEndReportPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Enter Zoho invoice" }));
    fireEvent.change(screen.getByLabelText("Zoho invoice number"), { target: { value: "INV-000123" } });
    fireEvent.change(screen.getByLabelText("Invoice date"), { target: { value: "2026-11-03" } });
    expect(screen.getByText(/Due 2026-12-03/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(setZohoInvoiceRequest).toHaveBeenCalledWith("test-token", "st-1", {
        invoiceNumber: "INV-000123",
        invoiceDate: "2026-11-03",
        termsDays: 30,
      }),
    );
  });

  it("marks an invoiced statement paid, and flags it overdue", async () => {
    vi.mocked(getMonthEndReportRequest).mockResolvedValue(
      report([row({ status: "invoiced_external", zohoInvoiceNumber: "INV-000123", dueOn: "2026-12-03", daysOverdue: 5 })]),
    );
    vi.mocked(markStatementPaidRequest).mockResolvedValue(row({ status: "paid" }));
    render(<MonthEndReportPanel />);
    expect(await screen.findByText("5 days overdue")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Mark as paid" })[0]);
    fireEvent.change(screen.getByLabelText("Reference (optional)"), { target: { value: "EFT 4411" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Mark as paid" }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(markStatementPaidRequest).toHaveBeenCalledWith("test-token", "st-1", expect.objectContaining({ reference: "EFT 4411" })),
    );
  });
});
