import * as Stripe from 'stripe';
import { InvoiceStatus } from '../invoices/invoiceStatuses';
import { InvoiceTotals, toInvoiceTotals } from '../invoices/invoiceAmounts';

// Pure translation of a Stripe invoice event into the only thing a webhook
// may change: our invoice's status and totals. No I/O, so it's
// unit-testable with plain objects.

export const INVOICE_STATUS_BY_EVENT: Record<string, InvoiceStatus> = {
  'invoice.finalized': 'synced',
  'invoice.paid': 'paid',
  'invoice.payment_failed': 'payment_failed',
};

export const CHARGE_REFUNDED_EVENT = 'charge.refunded';

export interface InvoiceEventUpdate {
  stripeInvoiceId: string;
  // From metadata.fieldInvoiceId, when it's a well-formed id.
  fieldInvoiceId: string | null;
  status: InvoiceStatus;
  totals: InvoiceTotals;
  amountPaidCents: number;
  hostedInvoiceUrl: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isInvoiceStatusEvent = (eventType: string): boolean =>
  eventType in INVOICE_STATUS_BY_EVENT;

export const toInvoiceEventUpdate = (
  eventType: string,
  invoice: Stripe.Invoice,
): InvoiceEventUpdate => {
  const fieldInvoiceId = invoice.metadata?.fieldInvoiceId;
  return {
    stripeInvoiceId: invoice.id as string,
    fieldInvoiceId:
      fieldInvoiceId && UUID_PATTERN.test(fieldInvoiceId)
        ? fieldInvoiceId
        : null,
    status: INVOICE_STATUS_BY_EVENT[eventType],
    totals: toInvoiceTotals(invoice),
    amountPaidCents: invoice.amount_paid,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
  };
};

export const paymentIntentIdOf = (charge: Stripe.Charge): string | null => {
  const paymentIntent = charge.payment_intent;
  if (!paymentIntent) return null;
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
};
