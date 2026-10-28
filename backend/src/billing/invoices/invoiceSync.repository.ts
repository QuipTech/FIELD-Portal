import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { InvoiceTotals } from './invoiceAmounts';
import { statusesMovableTo } from './invoiceStatuses';

// The writes made while pushing one invoice to Stripe. Each records a step
// as soon as Stripe confirms it, so a retried push resumes where it
// stopped instead of repeating it.

export const lockInvoiceLines = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceId: string,
): Promise<void> => {
  await serviceDatabase.query(
    `UPDATE billing.invoices SET status = 'final' WHERE id = $1 AND status = 'draft'`,
    [invoiceId],
  );
};

export const saveStripeInvoiceId = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceId: string,
  stripeInvoiceId: string,
): Promise<void> => {
  await serviceDatabase.query(
    `UPDATE billing.invoices SET stripe_invoice_id = $2 WHERE id = $1`,
    [invoiceId, stripeInvoiceId],
  );
};

export const saveStripeInvoiceItemId = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceLineId: string,
  stripeInvoiceItemId: string,
): Promise<void> => {
  await serviceDatabase.query(
    `UPDATE billing.invoice_lines SET stripe_invoice_item_id = $2 WHERE id = $1`,
    [invoiceLineId, stripeInvoiceItemId],
  );
};

// Totals and the link are always saved; the status only moves forward (a
// webhook may already have marked it paid).
export const markInvoiceSynced = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceId: string,
  totals: InvoiceTotals,
  hostedInvoiceUrl: string | null,
  dueOn: string | null = null,
): Promise<void> => {
  await serviceDatabase.query(
    `UPDATE billing.invoices SET
       total_ex_gst_cents = $2, gst_cents = $3, total_cents = $4,
       hosted_invoice_url = COALESCE($5, hosted_invoice_url),
       status = CASE WHEN status = ANY($6::varchar[]) THEN 'synced' ELSE status END,
       due_on = COALESCE($7::date, due_on)
     WHERE id = $1`,
    [
      invoiceId,
      totals.totalExGstCents,
      totals.gstCents,
      totals.totalCents,
      hostedInvoiceUrl,
      statusesMovableTo('synced'),
      dueOn,
    ],
  );
};
