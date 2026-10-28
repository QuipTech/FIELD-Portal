import { InvoiceStatus } from '../invoiceStatuses';
import { InvoiceLineRow, InvoiceRow } from './invoiceRows';

// Every amount is integer cents in the invoice's currency.
export interface InvoiceSummary {
  id: string;
  billingAccountId: string;
  billingAccountName: string;
  status: InvoiceStatus;
  currency: string;
  stripeInvoiceId: string | null;
  totalExGstCents: number;
  // null until Stripe has calculated tax (status synced or later).
  gstCents: number | null;
  totalCents: number | null;
  amountPaidCents: number;
  amountRefundedCents: number;
  hostedInvoiceUrl: string | null;
  // The billing month and review window of a monthly run invoice.
  periodStart: string | null;
  periodEnd: string | null;
  reviewUntil: string | null;
  heldAt: string | null;
  holdReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  position: number;
  lineType: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  stripeInvoiceItemId: string | null;
  // Peak, day and price book behind a monthly run line.
  calcSnapshot: Record<string, unknown> | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  lines: InvoiceLine[];
}

export interface InvoiceList {
  items: InvoiceSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const toCentsOrNull = (value: string | null): number | null =>
  value === null ? null : Number(value);

export const toInvoiceSummary = (row: InvoiceRow): InvoiceSummary => ({
  id: row.id,
  billingAccountId: row.billing_account_id,
  billingAccountName: row.billing_account_name,
  status: row.status,
  currency: row.currency,
  stripeInvoiceId: row.stripe_invoice_id,
  totalExGstCents: Number(row.total_ex_gst_cents),
  gstCents: toCentsOrNull(row.gst_cents),
  totalCents: toCentsOrNull(row.total_cents),
  amountPaidCents: Number(row.amount_paid_cents),
  amountRefundedCents: Number(row.amount_refunded_cents),
  hostedInvoiceUrl: row.hosted_invoice_url,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  reviewUntil: row.review_until?.toISOString() ?? null,
  heldAt: row.held_at?.toISOString() ?? null,
  holdReason: row.hold_reason,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const toInvoiceLine = (row: InvoiceLineRow): InvoiceLine => ({
  id: row.id,
  position: row.position,
  lineType: row.line_type,
  description: row.description,
  quantity: row.quantity,
  unitCents: Number(row.unit_cents),
  amountCents: Number(row.amount_cents),
  stripeInvoiceItemId: row.stripe_invoice_item_id,
  calcSnapshot: row.calc_snapshot,
});

export const toInvoiceDetail = (
  row: InvoiceRow,
  lines: InvoiceLineRow[],
): InvoiceDetail => ({
  ...toInvoiceSummary(row),
  lines: lines.map(toInvoiceLine),
});
