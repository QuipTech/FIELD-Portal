// How the admin billing page groups invoices. Stripe's own words differ
// slightly; these are what a billing admin acts on.
export const ADMIN_INVOICE_CATEGORIES = [
  'paid',
  'unpaid',
  'failed',
  'pending',
  'refunded',
  'void',
] as const;

export type AdminInvoiceCategory = (typeof ADMIN_INVOICE_CATEGORIES)[number];

// SQL for an invoice's category (aliases: i = billing.invoices). A refund
// outranks the status, because a refunded invoice stays "paid" in Stripe.
//   paid     → paid in full on Stripe
//   unpaid   → sent to Stripe, waiting for payment
//   failed   → Stripe tried to charge and failed
//   pending  → not on Stripe yet (draft, being finalised, or Checkout open)
//   refunded → paid, then partly or fully refunded
//   void     → cancelled
export const CATEGORY_SQL = `CASE
    WHEN i.amount_refunded_cents > 0 THEN 'refunded'
    WHEN i.status = 'paid' THEN 'paid'
    WHEN i.status = 'synced' THEN 'unpaid'
    WHEN i.status = 'payment_failed' THEN 'failed'
    WHEN i.status = 'void' THEN 'void'
    ELSE 'pending'
  END`;
