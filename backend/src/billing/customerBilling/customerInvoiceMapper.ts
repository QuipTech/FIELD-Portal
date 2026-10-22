import { CustomerInvoiceRow } from './customerBilling.repository';

// Integer cents, like every billing amount. totalCents and gstCents are
// null until Stripe has calculated tax.
export interface CustomerInvoice {
  id: string;
  status: string;
  currency: string;
  totalCents: number | null;
  gstCents: number | null;
  amountPaidCents: number;
  // Stripe's page to view and pay the invoice.
  hostedInvoiceUrl: string | null;
  // GET …/invoices/:id/pdf will return a link.
  hasPdf: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

const toCents = (value: string | null): number | null =>
  value === null ? null : Number(value);

export const toCustomerInvoice = (
  row: CustomerInvoiceRow,
): CustomerInvoice => ({
  id: row.id,
  status: row.status,
  currency: row.currency,
  totalCents: toCents(row.total_cents),
  gstCents: toCents(row.gst_cents),
  amountPaidCents: Number(row.amount_paid_cents),
  hostedInvoiceUrl: row.hosted_invoice_url,
  hasPdf: row.has_stripe_invoice,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  createdAt: row.created_at.toISOString(),
});
