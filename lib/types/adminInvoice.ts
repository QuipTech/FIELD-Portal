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
  invoiceKind: "monthly" | "annual" | "onboarding" | "personal" | "manual" | "machine_final";
  // Monthly drafts wait until this for review, unless held.
  reviewUntil: string | null;
  heldAt: string | null;
  amountCreditedCents: number;
  dueOn: string | null;
  // How Stripe collects it, set once it's on Stripe.
  collectionMethod: "charge_automatically" | "send_invoice" | null;
  poNumber: string | null;
  paymentType: "card" | "account";
  // Paid outside Stripe (recorded by a platform administrator).
  markedPaidOn: string | null;
  // e.g. "fully_discounted": a A$0 month that was never sent.
  noChargeReason: string | null;
  // The customer chose to pay by bank transfer; Mark as paid approves it.
  payByBankTransfer: boolean;
  // Unpaid and emailed (not charged to a card): can be marked paid.
  canMarkPaid: boolean;
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
