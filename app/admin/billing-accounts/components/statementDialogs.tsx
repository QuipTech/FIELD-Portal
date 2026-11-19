"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { markStatementPaidRequest, setZohoInvoiceRequest } from "@/lib/api/statementsApi";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingMonth } from "@/lib/format/billingDay";
import type { MonthEndReportRow } from "@/lib/types/billingStatement";

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const describe = (row: MonthEndReportRow) =>
  `${row.organisationName} · ${formatBillingMonth(row.billingMonth)} · ${audMoney(row.totalIncGstCents)} inc GST`;

interface DialogProps {
  row: MonthEndReportRow;
  onSaved: (message: string) => void;
  onClose: () => void;
}

// Records the Zoho Books invoice for a statement: it becomes "Invoiced in
// Zoho", due the invoice date plus the account's terms.
export const ZohoInvoiceDialog = ({ row, onSaved, onClose }: DialogProps) => {
  const [invoiceNumber, setInvoiceNumber] = useState(row.zohoInvoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(row.zohoInvoiceDate ?? localToday());
  const [termsDays, setTermsDays] = useState(String(row.termsDays));
  const terms = Number(termsDays);
  const isValid = invoiceNumber.trim().length > 0 && DATE_PATTERN.test(invoiceDate) && terms >= 1 && terms <= 120;
  return (
    <ConfirmDialog
      title="Zoho invoice"
      confirmLabel="Save"
      confirmVariant="primary"
      isConfirmDisabled={!isValid}
      onConfirm={async () => {
        await setZohoInvoiceRequest(requireAccessToken(), row.statementId, {
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          termsDays: terms,
        });
        onSaved(`${row.organisationName}: Zoho invoice ${invoiceNumber.trim()} saved.`);
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save the Zoho invoice. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>{describe(row)}. Reference {row.reference}.</p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Zoho invoice number
          <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} maxLength={60} className={inputClass} />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Invoice date
            <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Terms (days)
            <input
              value={termsDays}
              onChange={(event) => setTermsDays(event.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className={inputClass}
            />
          </label>
        </div>
        {isValid && <p className="text-xs text-bodyGray">Due {addDays(invoiceDate, terms)}. Reminders and the overdue list use this date.</p>}
      </div>
    </ConfirmDialog>
  );
};

export const StatementPaidDialog = ({ row, onSaved, onClose }: DialogProps) => {
  const [paidOn, setPaidOn] = useState(localToday());
  const [reference, setReference] = useState("");
  return (
    <ConfirmDialog
      title="Mark statement as paid"
      confirmLabel="Mark as paid"
      confirmVariant="primary"
      isConfirmDisabled={!DATE_PATTERN.test(paidOn)}
      onConfirm={async () => {
        await markStatementPaidRequest(requireAccessToken(), row.statementId, {
          paidOn,
          ...(reference.trim() && { reference: reference.trim() }),
        });
        onSaved(`${row.organisationName}'s statement marked as paid.`);
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't mark the statement as paid. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          {describe(row)}. Zoho invoice {row.zohoInvoiceNumber}. Reminders stop.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Date received
          <input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Reference (optional)
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={140}
            placeholder="e.g. bank transaction ID"
            className={inputClass}
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
