"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  exportMonthEndRequest,
  getMonthEndReportRequest,
  getStatementMachinesRequest,
  markMonthReadyRequest,
} from "@/lib/api/statementsApi";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay, formatBillingMonth } from "@/lib/format/billingDay";
import { saveBlobAsFile } from "@/lib/format/saveBlobAsFile";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  STATEMENT_STATUS_LABELS,
  type MonthEndFilters,
  type MonthEndReportRow,
  type StatementExportFormat,
  type StatementMachine,
  type StatementStatus,
} from "@/lib/types/billingStatement";
import { StatementPaidDialog, ZohoInvoiceDialog } from "./statementDialogs";

const selectClass = "h-9 rounded-lg border border-borderGrayStrong bg-surface px-2 text-sm text-ink outline-none";

const STATUS_TONES: Record<StatementStatus, Tone> = {
  draft: "default",
  ready: "primary",
  invoiced_external: "amber",
  paid: "ok",
  void: "default",
};

// The last 12 closed months, newest first, as YYYY-MM.
const recentMonths = (now = new Date()) =>
  Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

const firstOfNextMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 10);
};

const money = (cents: number | null) => (cents === null ? "—" : audMoney(cents));
// Discounts are negative: "−A$140.00".
const signedMoney = (cents: number) => (cents < 0 ? `−${audMoney(-cents)}` : audMoney(cents));

// Billing → Month-end report: 30-day account statements for a month, to
// invoice in Zoho Books. Export the report or the Zoho import, mark the
// month ready (locking it), then record each Zoho invoice and payment.
export const MonthEndReportPanel = () => {
  const months = recentMonths();
  const [filters, setFilters] = useState<MonthEndFilters>({ month: months[0], paymentType: "account", status: "all" });
  const [invoiceDate, setInvoiceDate] = useState(firstOfNextMonth(months[0]));
  const report = useApiResource(
    (token) => getMonthEndReportRequest(token, filters),
    [filters.month, filters.paymentType, filters.status],
    "Couldn't load the month-end report.",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<StatementExportFormat | null>(null);
  const [confirmReady, setConfirmReady] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [zohoRow, setZohoRow] = useState<MonthEndReportRow | null>(null);
  const [paidRow, setPaidRow] = useState<MonthEndReportRow | null>(null);
  const rows = report.data?.rows ?? [];

  const runExport = async (format: StatementExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const { blob, fileName } = await exportMonthEndRequest(
        requireAccessToken(),
        filters,
        format,
        format === "zoho" ? invoiceDate : undefined,
      );
      saveBlobAsFile(blob, fileName);
    } catch (exportError) {
      setError(toApiErrorMessage(exportError, "Couldn't export the report. Please try again."));
    } finally {
      setExporting(null);
    }
  };

  const onSaved = (text: string) => {
    setMessage(text);
    setZohoRow(null);
    setPaidRow(null);
    report.reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-bodyGray">
          Billing month
          <select
            value={filters.month}
            onChange={(event) => {
              setFilters({ ...filters, month: event.target.value });
              setInvoiceDate(firstOfNextMonth(event.target.value));
              setExpanded(null);
            }}
            className={selectClass}
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {formatBillingMonth(`${month}-01`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-bodyGray">
          Payment type
          <select
            value={filters.paymentType}
            onChange={(event) => setFilters({ ...filters, paymentType: event.target.value as MonthEndFilters["paymentType"] })}
            className={selectClass}
          >
            <option value="account">30-day account</option>
            <option value="card">Card</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-bodyGray">
          Status
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value as MonthEndFilters["status"] })}
            className={selectClass}
          >
            <option value="all">All (not void)</option>
            {(Object.keys(STATEMENT_STATUS_LABELS) as StatementStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATEMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Button size="sm" disabled={exporting !== null} onClick={() => runExport("csv")}>
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </Button>
          <Button size="sm" disabled={exporting !== null} onClick={() => runExport("xlsx")}>
            {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
          </Button>
          <label className="flex flex-col gap-1 text-xs text-bodyGray">
            Zoho invoice date
            <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={selectClass} />
          </label>
          <Button size="sm" disabled={exporting !== null || !invoiceDate} onClick={() => runExport("zoho")}>
            {exporting === "zoho" ? "Exporting…" : "Zoho import (CSV)"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!report.data || report.data.locked}
            onClick={() => setConfirmReady(true)}
          >
            {report.data?.locked ? "Month is ready" : "Mark month as ready"}
          </Button>
        </div>
      </div>

      {report.data?.locked && report.data.lockedAt && (
        <p className="text-sm text-bodyGray">
          Locked on {formatBillingDay(report.data.lockedAt)}. New charges for this month go on next month&apos;s statement.
        </p>
      )}
      {message && <p role="status" className="text-sm text-bodyGray">{message}</p>}
      {(error || report.error) && <p className="text-sm text-danger">{error ?? report.error}</p>}
      {report.isLoading && !report.data && (
        <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>
      )}
      {report.data && rows.length === 0 && <p className="text-sm text-bodyGray">No statements for this month.</p>}

      {report.data && rows.length > 0 && (
        <>
          <p className="text-sm text-bodyGray">
            {rows.length} statement{rows.length === 1 ? "" : "s"} · {audMoney(report.data.totals.subtotalExGstCents)} ex GST ·{" "}
            {audMoney(report.data.totals.gstCents)} GST · <span className="font-medium text-ink">{audMoney(report.data.totals.totalIncGstCents)} inc GST</span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-borderGray bg-surface">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-fillGray text-xs uppercase tracking-wide text-bodyGray">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Organisation</th>
                  <th className="px-3 py-2.5 font-medium">Accounts email / PO</th>
                  <th className="px-3 py-2.5 text-right font-medium">Peak</th>
                  <th className="px-3 py-2.5 font-medium">Band · unit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Machines</th>
                  <th className="px-3 py-2.5 text-right font-medium">Discounts</th>
                  <th className="px-3 py-2.5 text-right font-medium">Ex GST</th>
                  <th className="px-3 py-2.5 text-right font-medium">GST</th>
                  <th className="px-3 py-2.5 text-right font-medium">Inc GST</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ReportRow
                    key={row.statementId}
                    row={row}
                    isExpanded={expanded === row.statementId}
                    onToggle={() => setExpanded(expanded === row.statementId ? null : row.statementId)}
                    onZoho={() => setZohoRow(row)}
                    onPaid={() => setPaidRow(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirmReady && (
        <ConfirmDialog
          title={`Mark ${formatBillingMonth(`${filters.month}-01`)} as ready?`}
          confirmLabel="Mark as ready"
          confirmVariant="primary"
          onConfirm={async () => {
            const result = await markMonthReadyRequest(requireAccessToken(), filters.month);
            setConfirmReady(false);
            onSaved(`${formatBillingMonth(`${filters.month}-01`)} is ready: ${result.lockedCount} statement${result.lockedCount === 1 ? "" : "s"} locked.`);
          }}
          onClose={() => setConfirmReady(false)}
          toErrorMessage={(readyError) => toApiErrorMessage(readyError, "Couldn't mark the month as ready. Please try again.")}
        >
          <p>
            Every draft statement for this month is locked so it matches what you invoice in Zoho. Charges made from now on go on next
            month&apos;s statement. This can&apos;t be undone.
          </p>
        </ConfirmDialog>
      )}
      {zohoRow && <ZohoInvoiceDialog row={zohoRow} onSaved={onSaved} onClose={() => setZohoRow(null)} />}
      {paidRow && <StatementPaidDialog row={paidRow} onSaved={onSaved} onClose={() => setPaidRow(null)} />}
    </div>
  );
};

interface ReportRowProps {
  row: MonthEndReportRow;
  isExpanded: boolean;
  onToggle: () => void;
  onZoho: () => void;
  onPaid: () => void;
}

const ReportRow = ({ row, isExpanded, onToggle, onZoho, onPaid }: ReportRowProps) => {
  const discounts = row.freePeriodDiscountCents + row.promoDiscountCents;
  return (
    <>
      <tr className="border-t border-borderGray align-top">
        <td className="px-3 py-3">
          <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="text-left">
            <span className="font-medium text-ink">{row.organisationName}</span>
            <span className="block text-xs text-bodyGray">
              {[row.legalName, row.abn && `ABN ${row.abn}`].filter(Boolean).join(" · ") || "No legal name"}
            </span>
            <span className="block text-xs text-primary">{isExpanded ? "Hide details" : "Show details"}</span>
          </button>
        </td>
        <td className="px-3 py-3 text-bodyGray">
          <span className="block truncate">{row.accountsEmail ?? "—"}</span>
          <span className="block text-xs">{row.poNumber ? `PO ${row.poNumber}` : "No PO"}</span>
        </td>
        <td className="px-3 py-3 text-right">{row.peakActiveMachines ?? "—"}</td>
        <td className="px-3 py-3 text-bodyGray">
          {row.rateBand ?? "—"}
          {row.unitPriceCents !== null && <span className="block text-xs">{audMoney(row.unitPriceCents)} each</span>}
        </td>
        <td className="px-3 py-3 text-right">{money(row.machineChargeCents)}</td>
        <td className="px-3 py-3 text-right">
          {discounts === 0 ? "—" : signedMoney(discounts)}
          {row.freePeriodDiscountCents !== 0 && <span className="block text-xs text-bodyGray">Free period {signedMoney(row.freePeriodDiscountCents)}</span>}
          {row.promoDiscountCents !== 0 && (
            <span className="block text-xs text-bodyGray">
              {row.promoCode ?? "Promo"} {signedMoney(row.promoDiscountCents)}
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right">{audMoney(row.subtotalExGstCents)}</td>
        <td className="px-3 py-3 text-right">{audMoney(row.gstCents)}</td>
        <td className="px-3 py-3 text-right font-medium">{audMoney(row.totalIncGstCents)}</td>
        <td className="px-3 py-3">
          <div className="flex flex-col items-start gap-1">
            <Tag tone={STATUS_TONES[row.status]}>{STATEMENT_STATUS_LABELS[row.status]}</Tag>
            {row.daysOverdue !== null && row.daysOverdue > 0 && <Tag tone="danger">{row.daysOverdue} days overdue</Tag>}
            {row.zohoInvoiceNumber && <span className="text-xs text-bodyGray">Zoho {row.zohoInvoiceNumber}</span>}
            {row.dueOn && row.status === "invoiced_external" && (
              <span className="text-xs text-bodyGray">Due {formatBillingDay(row.dueOn)}</span>
            )}
            {row.paidOn && <span className="text-xs text-bodyGray">Paid {formatBillingDay(row.paidOn)}</span>}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-col items-end gap-1.5">
            {(row.status === "ready" || row.status === "invoiced_external") && (
              <Button size="sm" onClick={onZoho}>
                {row.zohoInvoiceNumber ? "Edit Zoho invoice" : "Enter Zoho invoice"}
              </Button>
            )}
            {row.status === "invoiced_external" && (
              <Button size="sm" variant="primary" onClick={onPaid}>
                Mark as paid
              </Button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-fillGray/40">
          <td colSpan={11} className="px-3 pb-4 pt-1">
            <StatementDetail row={row} />
          </td>
        </tr>
      )}
    </>
  );
};

const StatementDetail = ({ row }: { row: MonthEndReportRow }) => {
  const machines = useApiResource<StatementMachine[]>(
    (token) => getStatementMachinesRequest(token, row.statementId),
    [row.statementId],
    "Couldn't load the machines.",
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-bodyGray">Lines · {row.reference}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {row.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="text-bodyGray">{line.description}</span>
              <span className="whitespace-nowrap">{signedMoney(line.amountCents)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-bodyGray">Machines active this month</p>
        {machines.error && <p className="text-sm text-danger">{machines.error}</p>}
        {machines.isLoading && !machines.data && <LoadingSpinner />}
        {machines.data?.length === 0 && <p className="text-sm text-bodyGray">No machines were active.</p>}
        {machines.data && machines.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-bodyGray">
              <tr>
                <th className="py-1 text-left font-medium">Plant ID</th>
                <th className="py-1 text-left font-medium">Model</th>
                <th className="py-1 text-left font-medium">Serial</th>
                <th className="py-1 text-right font-medium">Active days</th>
              </tr>
            </thead>
            <tbody>
              {machines.data.map((machine) => (
                <tr key={machine.machineId} className="border-t border-borderGray">
                  <td className="py-1">
                    {machine.plantId ?? "—"} {machine.deleted && <Tag>Deleted</Tag>}
                  </td>
                  <td className="py-1 text-bodyGray">{[machine.manufacturer, machine.model].filter(Boolean).join(" ") || "—"}</td>
                  <td className="py-1 text-bodyGray">{machine.serialNumber}</td>
                  <td className="py-1 text-right">{machine.activeDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
