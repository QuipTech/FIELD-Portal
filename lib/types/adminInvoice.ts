// See backend/src/billing/adminInvoices/adminInvoiceCategories.ts.
export const ADMIN_INVOICE_CATEGORIES = ["paid", "unpaid", "failed", "pending", "refunded", "void"] as const;
export type AdminInvoiceCategory = (typeof ADMIN_INVOICE_CATEGORIES)[number];

export interface AdminInvoice {
  id: string;
  category: AdminInvoiceCategory;
  status: string;
  // personal: one user's FIELD Technician subscription; organisation: a monthly or test invoice.
  kind: "personal" | "organisation";
  payerEmail: string | null;
  payerName: string | null;
  organisationName: string;
  periodStart: string | null;
  totalExGstCents: number;
  gstCents: number | null;
  totalCents: number | null;
  amountPaidCents: number;
  amountRefundedCents: number;
  stripeInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInvoiceCategorySummary {
  count: number;
  totalCents: number;
  paidCents: number;
}

export interface AdminInvoiceList {
  items: AdminInvoice[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<AdminInvoiceCategory, AdminInvoiceCategorySummary>;
}

export interface StripeRefreshResult {
  checked: number;
  updated: number;
  failed: number;
}
