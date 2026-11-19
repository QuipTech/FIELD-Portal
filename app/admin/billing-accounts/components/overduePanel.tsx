"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listOverdueRequest } from "@/lib/api/paymentTermsApi";
import { listOverdueStatementsRequest } from "@/lib/api/statementsApi";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { OverdueInvoice } from "@/lib/types/paymentTerms";
import { MarkPaidDialog } from "./markPaidDialog";

const describeReminder = (offset: number | null) => {
  if (offset === null) return "None yet";
  if (offset < 0) return `${-offset} days before due`;
  if (offset === 0) return "On due date";
  return `${offset} days overdue`;
};

// Overdue Zoho invoices for 30-day accounts, then every overdue Stripe
// invoice, most overdue first, with what's owed
// and the last reminder sent. Over a credit limit is flagged, never
// blocked; suspension stays a manual action under Billing accounts.
export const OverduePanel = () => {
  const overdue = useApiResource(listOverdueRequest, [], "Couldn't load overdue invoices.");
  const statements = useApiResource(listOverdueStatementsRequest, [], "Couldn't load overdue Zoho invoices.");
  const [markingPaid, setMarkingPaid] = useState<OverdueInvoice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const total = (overdue.data ?? []).reduce((sum, invoice) => sum + invoice.outstandingCents, 0);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-medium text-ink">30-day accounts (Zoho invoices)</h2>
      <p className="text-sm text-bodyGray">
        Due the Zoho invoice date plus the account&apos;s terms. Record payments on the Month-end report.
      </p>
      {statements.error && <p className="text-sm text-danger">{statements.error}</p>}
      {statements.data?.length === 0 && <p className="text-sm text-bodyGray">No Zoho invoices are overdue.</p>}
      {statements.data && statements.data.length > 0 && (
        <Table>
          <TableHeaderRow>
            <TableHeaderCell flex={1.6}>Account</TableHeaderCell>
            <TableHeaderCell>Zoho invoice</TableHeaderCell>
            <TableHeaderCell>Due</TableHeaderCell>
            <TableHeaderCell flex={0.7}>Overdue</TableHeaderCell>
            <TableHeaderCell>Inc GST</TableHeaderCell>
            <TableHeaderCell>Last reminder</TableHeaderCell>
          </TableHeaderRow>
          {statements.data.map((statement) => (
            <TableRow key={statement.statementId}>
              <TableCell flex={1.6} className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{statement.accountName}</span>
                {statement.suspended && <Tag tone="danger">Suspended</Tag>}
              </TableCell>
              <TableCell className="text-bodyGray">{statement.zohoInvoiceNumber}</TableCell>
              <TableCell className="text-bodyGray">{formatBillingDay(statement.dueOn)}</TableCell>
              <TableCell flex={0.7}>
                <Tag tone={statement.daysOverdue >= 14 ? "danger" : "amber"}>{statement.daysOverdue} days</Tag>
              </TableCell>
              <TableCell>{audMoney(statement.outstandingCents)}</TableCell>
              <TableCell className="text-bodyGray">{describeReminder(statement.lastReminderOffset)}</TableCell>
            </TableRow>
          ))}
        </Table>
      )}
      <h2 className="mt-4 text-base font-medium text-ink">Stripe invoices</h2>
      {overdue.data && overdue.data.length > 0 && (
        <p className="text-sm text-bodyGray">
          {overdue.data.length} overdue invoice{overdue.data.length === 1 ? "" : "s"} · {audMoney(total)} outstanding
        </p>
      )}
      {message && <p role="status" className="text-sm text-bodyGray">{message}</p>}
      {overdue.error && <p className="text-sm text-danger">{overdue.error}</p>}
      {overdue.isLoading && !overdue.data && (
        <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>
      )}
      {overdue.data?.length === 0 && <p className="text-sm text-bodyGray">Nothing is overdue.</p>}
      {overdue.data && overdue.data.length > 0 && (
        <Table>
          <TableHeaderRow>
            <TableHeaderCell flex={1.6}>Account</TableHeaderCell>
            <TableHeaderCell>Due</TableHeaderCell>
            <TableHeaderCell flex={0.7}>Overdue</TableHeaderCell>
            <TableHeaderCell>Outstanding</TableHeaderCell>
            <TableHeaderCell>Last reminder</TableHeaderCell>
            <TableHeaderCell flex={1.2}> </TableHeaderCell>
          </TableHeaderRow>
          {overdue.data.map((invoice) => (
            <TableRow key={invoice.invoiceId}>
              <TableCell flex={1.6} className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{invoice.accountName}</span>
                {invoice.paymentType === "account" && <Tag>Account</Tag>}
                {invoice.suspended && <Tag tone="danger">Suspended</Tag>}
                {invoice.overCreditLimit && <Tag tone="danger">Over credit limit</Tag>}
              </TableCell>
              <TableCell className="text-bodyGray">{formatBillingDay(invoice.dueOn)}</TableCell>
              <TableCell flex={0.7}>
                <Tag tone={invoice.daysOverdue >= 14 ? "danger" : "amber"}>{invoice.daysOverdue} days</Tag>
              </TableCell>
              <TableCell>{audMoney(invoice.outstandingCents)}</TableCell>
              <TableCell className="text-bodyGray">{describeReminder(invoice.lastReminderOffset)}</TableCell>
              <TableCell flex={1.2} className="flex flex-wrap justify-end gap-2">
                {invoice.hostedInvoiceUrl && (
                  <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                    Invoice
                  </a>
                )}
                <Button size="sm" onClick={() => setMarkingPaid(invoice)}>
                  Mark as paid
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      )}
      {markingPaid && (
        <MarkPaidDialog
          invoiceId={markingPaid.invoiceId}
          label={`${markingPaid.accountName} · due ${formatBillingDay(markingPaid.dueOn)} · ${audMoney(markingPaid.outstandingCents)}`}
          onSaved={() => {
            setMessage(`${markingPaid.accountName}'s invoice marked as paid.`);
            setMarkingPaid(null);
            overdue.reload();
          }}
          onClose={() => setMarkingPaid(null)}
        />
      )}
    </div>
  );
};
