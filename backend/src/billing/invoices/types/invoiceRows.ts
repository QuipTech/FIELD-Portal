import { InvoiceStatus } from '../invoiceStatuses';

// bigint columns arrive from pg as strings; invoiceResponse.ts converts.
export interface InvoiceRow {
  id: string;
  billing_account_id: string;
  billing_account_name: string;
  status: InvoiceStatus;
  currency: string;
  stripe_invoice_id: string | null;
  total_ex_gst_cents: string;
  gst_cents: string | null;
  total_cents: string | null;
  amount_paid_cents: string;
  amount_refunded_cents: string;
  hosted_invoice_url: string | null;
  // Monthly run invoices only; null for personal and test invoices.
  period_start: string | null;
  period_end: string | null;
  review_until: Date | null;
  held_at: Date | null;
  hold_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  position: number;
  line_type: string;
  description: string;
  quantity: number;
  unit_cents: string;
  amount_cents: string;
  stripe_invoice_item_id: string | null;
  calc_snapshot: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}
