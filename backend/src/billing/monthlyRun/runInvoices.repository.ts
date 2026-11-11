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
         AND kind = 'monthly' AND status <> 'void') AS found`,
    [billingAccountId, periodStart],
  );
  return result.rows[0]?.found === true;
};

// A machine paying for its days used before it is deleted.
export const MACHINE_FINAL_INVOICE_KIND = 'machine_final';

// kind 'monthly' (the run, in arrears, waits for review), 'annual' (a
// term's up-front invoice), 'onboarding' (assisted onboarding on
// completion) or 'machine_final' (paid on the spot through Stripe Checkout);
// annual and onboarding are finalised straight away.
export const insertRunInvoice = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    kind?: 'monthly' | 'annual' | 'onboarding' | 'machine_final';
    periodStart: string | null;
    periodEnd: string | null;
    reviewUntil: Date | null;
    totalExGstCents: number;
    lines: CalculatedLine[];
  },
): Promise<string> => {
  const invoice = await client.query<{ id: string }>(
    `INSERT INTO billing.invoices
       (billing_account_id, currency, total_ex_gst_cents, period_start, period_end,
        review_until, kind)
     VALUES ($1, 'AUD', $2, $3, $4, $5, $6) RETURNING id`,
    [
      params.billingAccountId,
      params.totalExGstCents,
      params.periodStart,
      params.periodEnd,
      params.reviewUntil,
      params.kind ?? 'monthly',
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
     WHERE (status = 'draft' AND kind = 'monthly' AND held_at IS NULL
            AND review_until <= $1)
        -- Up-front invoices whose Stripe push failed: retried. Not
        -- machine_final: it's paid through Stripe Checkout, which creates its
        -- own Stripe invoice, so pushing one too would bill it twice.
        OR (status IN ('draft', 'final') AND kind IN ('annual', 'onboarding')
            AND created_at <= $1::timestamptz - interval '10 minutes')
     ORDER BY coalesce(review_until, created_at), id`,
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
     WHERE id = $1 AND status = 'draft' AND kind = 'monthly'
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

// The intervals of machines that paid their own final charge for this month.
// A void charge doesn't count, so that machine goes back in the peak.
export const listFinalChargedIntervals = async (
  client: BillingReader,
  billingAccountId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ startedOn: string; billingEnd: string | null }[]> => {
  const result = await client.query<{
    started_on: string;
    billing_end: string | null;
  }>(
    `SELECT a.activated_on::text AS started_on, a.billing_end::text AS billing_end
     FROM billing.machine_final_charges c
     JOIN billing.invoices i ON i.id = c.invoice_id AND i.status <> 'void'
     JOIN billing.machine_activations a
       ON a.machine_id = c.machine_id AND a.billing_account_id = c.billing_account_id
      AND a.deleted_at IS NULL
      AND a.activated_on < $3::date
      AND (a.billing_end IS NULL OR a.billing_end > $2::date)
     WHERE c.billing_account_id = $1 AND c.period_start = $2::date`,
    [billingAccountId, periodStart, periodEnd],
  );
  return result.rows.map((row) => ({
    startedOn: row.started_on,
    billingEnd: row.billing_end,
  }));
};
