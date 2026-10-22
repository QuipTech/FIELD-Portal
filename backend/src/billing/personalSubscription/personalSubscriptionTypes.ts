import { InvoiceStatus } from '../invoices/invoiceStatuses';

export interface PersonalPeriodRow {
  id: string;
  invoice_id: string;
  billing_account_id: string;
  price_book_id: string;
  period_start: string;
  period_end: string;
  unit_cents: string;
  status: InvoiceStatus;
  total_cents: string | null;
  gst_cents: string | null;
  amount_paid_cents: string;
  amount_refunded_cents: string;
  hosted_invoice_url: string | null;
}

export interface PersonalBillingStatus {
  exempt: boolean;
  // An active TECH seat on the organisation's account pays for this month.
  coveredByOrganisation: boolean;
  paymentRequired: boolean;
  monthlyCents: number;
  priceBookId: string | null;
  currency: 'AUD';
  timezone: string;
  periodStart: string;
  periodEnd: string;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  gstCents: number | null;
  totalCents: number | null;
  hostedInvoiceUrl: string | null;
}

export const isPersonalPeriodPaid = (
  period: PersonalPeriodRow | undefined,
): boolean =>
  !!period &&
  period.status === 'paid' &&
  period.total_cents !== null &&
  Number(period.amount_refunded_cents) === 0 &&
  Number(period.amount_paid_cents) >= Number(period.total_cents);

// A refunded or void invoice can't be paid again, so the month gets a new one.
export const needsReplacementInvoice = (period: PersonalPeriodRow): boolean =>
  period.status === 'void' || Number(period.amount_refunded_cents) > 0;
