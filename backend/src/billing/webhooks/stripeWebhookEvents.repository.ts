import { PoolClient } from 'pg';
import { statusesMovableTo } from '../invoices/invoiceStatuses';
import { InvoiceEventUpdate } from './stripeInvoiceEvents';

// Webhook writes, on the service role, inside the event's transaction.

// True for an event's first delivery. Runs before the event is applied, in
// the same transaction: if applying fails the claim rolls back with it and
// Stripe's retry is processed normally. A concurrent duplicate waits on
// the unique index, then sees the conflict.
export const claimWebhookEvent = async (
  client: PoolClient,
  event: { id: string; type: string },
): Promise<boolean> => {
  const result = await client.query(
    `INSERT INTO billing.stripe_webhook_events (stripe_event_id, type)
     VALUES ($1, $2)
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id`,
    [event.id, event.type],
  );
  return (result.rowCount ?? 0) > 0;
};

// Status and totals only. The status moves forward only (see
// invoiceStatuses.ts); totals always take Stripe's latest figures. False
// when the invoice isn't one of ours.
export const applyInvoiceEventUpdate = async (
  client: PoolClient,
  update: InvoiceEventUpdate,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE billing.invoices SET
       stripe_invoice_id = COALESCE(stripe_invoice_id, $1),
       status = CASE WHEN status = ANY($3::varchar[]) THEN $4 ELSE status END,
       total_ex_gst_cents = $5, gst_cents = $6, total_cents = $7,
       amount_paid_cents = GREATEST(amount_paid_cents, $8),
       hosted_invoice_url = COALESCE($9, hosted_invoice_url)
     WHERE stripe_invoice_id = $1
        OR (stripe_invoice_id IS NULL AND id = $2::uuid)`,
    [
      update.stripeInvoiceId,
      update.fieldInvoiceId,
      statusesMovableTo(update.status),
      update.status,
      update.totals.totalExGstCents,
      update.totals.gstCents,
      update.totals.totalCents,
      update.amountPaidCents,
      update.hostedInvoiceUrl,
    ],
  );
  return (result.rowCount ?? 0) > 0;
};

// A refund leaves the invoice paid; only the refunded total changes.
export const saveAmountRefunded = async (
  client: PoolClient,
  stripeInvoiceId: string,
  amountRefundedCents: number,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE billing.invoices SET amount_refunded_cents = $2 WHERE stripe_invoice_id = $1`,
    [stripeInvoiceId, amountRefundedCents],
  );
  return (result.rowCount ?? 0) > 0;
};
