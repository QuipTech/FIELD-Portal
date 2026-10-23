import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { SubscriptionTerm } from '../subscriptions/subscriptionTypes';
import { CalculatedLine } from './monthlyRunTypes';

type BillingReader = Pick<ServiceDatabaseService, 'query'>;

export interface RunSubscriptionRow {
  id: string;
  plan_code: string;
  term: SubscriptionTerm;
  committed_qty: number | null;
  annual_months_charged: number | null;
  price_book_id: string;
}

// Subscriptions live at any point in [periodStart, periodEnd): started
// before the month ended and not cancelled before it began. Days are in
// the account's time zone.
export const listSubscriptionsForPeriod = async (
  client: BillingReader,
  billingAccountId: string,
  timezone: string,
  periodStart: string,
  periodEnd: string,
): Promise<RunSubscriptionRow[]> => {
  const result = await client.query<RunSubscriptionRow>(
    `SELECT id, plan_code, term, committed_qty, annual_months_charged, price_book_id
     FROM billing.subscriptions
     WHERE billing_account_id = $1 AND deleted_at IS NULL
       AND (started_at AT TIME ZONE $2)::date < $4::date
       AND (status <> 'cancelled' OR cancel_at IS NULL OR cancel_at > $3::date)
     ORDER BY plan_code, id`,
    [billingAccountId, timezone, periodStart, periodEnd],
  );
  return result.rows;
};

export const hasRunInvoice = async (
  client: BillingReader,
  billingAccountId: string,
  periodStart: string,
): Promise<boolean> => {
  const result = await client.query<{ found: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM billing.invoices
       WHERE billing_account_id = $1 AND period_start = $2::date
         AND status <> 'void') AS found`,
    [billingAccountId, periodStart],
  );
  return result.rows[0]?.found === true;
};

export const insertRunInvoice = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    periodStart: string;
    periodEnd: string;
    reviewUntil: Date;
    totalExGstCents: number;
    lines: CalculatedLine[];
  },
): Promise<string> => {
  const invoice = await client.query<{ id: string }>(
    `INSERT INTO billing.invoices
       (billing_account_id, currency, total_ex_gst_cents, period_start, period_end, review_until)
     VALUES ($1, 'AUD', $2, $3, $4, $5) RETURNING id`,
    [
      params.billingAccountId,
      params.totalExGstCents,
      params.periodStart,
      params.periodEnd,
      params.reviewUntil,
    ],
  );
  const invoiceId = invoice.rows[0].id;
  for (const [index, line] of params.lines.entries()) {
    await client.query(
      `INSERT INTO billing.invoice_lines
         (invoice_id, position, line_type, description, quantity, unit_cents,
          amount_cents, calc_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        invoiceId,
        index + 1,
        line.lineType,
        line.description,
        line.quantity,
        line.unitCents,
        line.amountCents,
        line.calcSnapshot,
      ],
    );
  }
  return invoiceId;
};

// Run drafts whose review window has passed and nobody has held.
export const listInvoicesDueForFinalisation = async (
  client: BillingReader,
  now: Date,
): Promise<{ id: string }[]> => {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM billing.invoices
     WHERE status = 'draft' AND period_start IS NOT NULL AND held_at IS NULL
       AND review_until <= $1
     ORDER BY review_until, id`,
    [now],
  );
  return result.rows;
};

// Only a run draft still in review can be held. Returns its account, or
// undefined when there is no such draft.
export const holdRunInvoice = async (
  client: PoolClient,
  params: { invoiceId: string; heldBy: string; reason: string },
): Promise<{ billing_account_id: string } | undefined> => {
  const result = await client.query<{ billing_account_id: string }>(
    `UPDATE billing.invoices
     SET held_at = now(), held_by = $2, hold_reason = $3, updated_at = now()
     WHERE id = $1 AND status = 'draft' AND period_start IS NOT NULL
       AND held_at IS NULL
     RETURNING billing_account_id`,
    [params.invoiceId, params.heldBy, params.reason],
  );
  return result.rows[0];
};

// Released drafts finalise on the next run once their window has passed.
export const releaseRunInvoice = async (
  client: PoolClient,
  invoiceId: string,
): Promise<
  { billing_account_id: string; hold_reason: string | null } | undefined
> => {
  const result = await client.query<{
    billing_account_id: string;
    hold_reason: string | null;
  }>(
    `UPDATE billing.invoices i
     SET held_at = NULL, held_by = NULL, hold_reason = NULL, updated_at = now()
     FROM (SELECT id, hold_reason FROM billing.invoices WHERE id = $1) old
     WHERE i.id = old.id AND i.status = 'draft' AND i.held_at IS NOT NULL
     RETURNING i.billing_account_id, old.hold_reason`,
    [invoiceId],
  );
  return result.rows[0];
};
