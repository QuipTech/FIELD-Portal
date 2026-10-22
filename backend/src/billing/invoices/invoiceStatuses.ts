// draft  → saved in FIELD, lines still editable
// final  → FIELD's lines are locked and being pushed to Stripe
// synced → finalised on Stripe; hosted invoice link and tax-inclusive totals saved
// paid / payment_failed / void → set by Stripe webhooks
export const INVOICE_STATUSES = [
  'draft',
  'final',
  'synced',
  'paid',
  'payment_failed',
  'void',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Statuses a webhook may move an invoice out of, per target status. A late
// or out-of-order event (e.g. payment_failed after paid) never moves an
// invoice backwards.
const ALLOWED_FROM: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: [],
  final: ['draft'],
  synced: ['draft', 'final'],
  payment_failed: ['draft', 'final', 'synced'],
  paid: ['draft', 'final', 'synced', 'payment_failed'],
  void: ['draft', 'final', 'synced', 'payment_failed'],
};

// The statuses an invoice may be in for an update to `to` to apply
// (itself included, so repeating an update is harmless).
export const statusesMovableTo = (to: InvoiceStatus): InvoiceStatus[] => [
  to,
  ...ALLOWED_FROM[to],
];
