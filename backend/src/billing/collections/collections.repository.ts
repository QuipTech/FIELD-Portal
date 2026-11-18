import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { CollectionMethod } from './overdueRules';

type Reader = Pick<ServiceDatabaseService, 'query'>;

// Unpaid: on Stripe and not yet paid (or its card payment failed).
const UNPAID = `i.status IN ('synced', 'payment_failed')`;

// What's still owed on an invoice, GST included once Stripe has it.
const OUTSTANDING = `(coalesce(i.total_cents, i.total_ex_gst_cents) - i.amount_paid_cents - i.amount_credited_cents)`;

export interface ReminderInvoiceRow {
  id: string;
  billing_account_id: string;
  account_name: string;
  billing_email: string;
  accounts_email: string | null;
  timezone: string;
  due_on: string;
  collection_method: CollectionMethod | null;
  outstanding_cents: string;
  hosted_invoice_url: string | null;
  sent_offsets: number[];
}

// Organisation invoices still unpaid whose due date is at most `leadDays`
// away (or past), with the reminders already sent. Personal TECH payments
// have their own prompt, so they are left out.
export const listInvoicesForReminders = async (
  database: Reader,
  leadDays: number,
): Promise<ReminderInvoiceRow[]> => {
  const result = await database.query<ReminderInvoiceRow>(
    `SELECT i.id, i.billing_account_id, a.name AS account_name, a.billing_email,
            a.accounts_email, a.timezone, i.due_on::text, i.collection_method,
            ${OUTSTANDING} AS outstanding_cents, i.hosted_invoice_url,
            coalesce(array_agg(r.offset_days) FILTER (WHERE r.id IS NOT NULL), '{}') AS sent_offsets
     FROM billing.invoices i
     JOIN billing.billing_accounts a ON a.id = i.billing_account_id
     LEFT JOIN billing.invoice_reminders r ON r.invoice_id = i.id
     WHERE ${UNPAID} AND i.due_on IS NOT NULL
       AND i.due_on <= (now() AT TIME ZONE a.timezone)::date + $1::int
       AND i.kind <> 'personal' AND a.deleted_at IS NULL
     GROUP BY i.id, a.id
     ORDER BY i.due_on, i.id`,
    [leadDays],
  );
  return result.rows;
};

// Records a reminder once; false when it was already recorded (another
// container got there first).
export const recordReminderSent = async (
  database: Reader,
  params: { invoiceId: string; billingAccountId: string; offsetDays: number },
): Promise<boolean> => {
  const result = await database.query(
    `INSERT INTO billing.invoice_reminders (invoice_id, billing_account_id, offset_days)
     VALUES ($1, $2, $3) ON CONFLICT (invoice_id, offset_days) DO NOTHING`,
    [params.invoiceId, params.billingAccountId, params.offsetDays],
  );
  return (result.rowCount ?? 0) > 0;
};

// The account's earliest due date still unpaid and past; null when none.
// Suspension's notice period counts from it.
export const findFirstUnpaidDueOn = async (
  database: Reader,
  billingAccountId: string,
): Promise<string | null> => {
  const result = await database.query<{ first: string | null }>(
    `SELECT min(i.due_on)::text AS first
     FROM billing.invoices i JOIN billing.billing_accounts a ON a.id = i.billing_account_id
     WHERE i.billing_account_id = $1 AND ${UNPAID} AND i.kind <> 'personal'
       AND i.due_on < (now() AT TIME ZONE a.timezone)::date`,
    [billingAccountId],
  );
  return result.rows[0]?.first ?? null;
};

export interface OverdueListRow {
  invoice_id: string;
  billing_account_id: string;
  account_name: string;
  payment_type: string;
  kind: string;
  period_start: string | null;
  due_on: string;
  days_overdue: number;
  outstanding_cents: string;
  hosted_invoice_url: string | null;
  last_reminder_offset: number | null;
  suspended_at: Date | null;
  credit_limit_cents: string | null;
  account_unpaid_cents: string;
}

// Every overdue organisation invoice, most overdue first, for the platform
// administrator's Overdue list.
export const listOverdueInvoices = async (
  database: Reader,
): Promise<OverdueListRow[]> => {
  const result = await database.query<OverdueListRow>(
    `SELECT i.id AS invoice_id, a.id AS billing_account_id, a.name AS account_name,
            a.payment_type, i.kind, i.period_start::text, i.due_on::text,
            ((now() AT TIME ZONE a.timezone)::date - i.due_on) AS days_overdue,
            ${OUTSTANDING} AS outstanding_cents, i.hosted_invoice_url,
            (SELECT max(r.offset_days) FROM billing.invoice_reminders r WHERE r.invoice_id = i.id)
              AS last_reminder_offset,
            a.suspended_at, a.credit_limit_cents,
            (SELECT coalesce(sum(coalesce(u.total_cents, u.total_ex_gst_cents) - u.amount_paid_cents - u.amount_credited_cents), 0)
             FROM billing.invoices u
             WHERE u.billing_account_id = a.id AND u.status IN ('synced', 'payment_failed')
               AND u.kind <> 'personal') AS account_unpaid_cents
     FROM billing.invoices i
     JOIN billing.billing_accounts a ON a.id = i.billing_account_id
     WHERE ${UNPAID} AND i.due_on IS NOT NULL AND i.kind <> 'personal'
       AND i.due_on < (now() AT TIME ZONE a.timezone)::date
       AND a.deleted_at IS NULL
     ORDER BY i.due_on, a.name, i.id`,
  );
  return result.rows;
};

export interface CreditLimitRow {
  id: string;
  name: string;
  credit_limit_cents: string | null;
  credit_limit_warned_at: Date | null;
  unpaid_cents: string;
}

// Accounts that have a credit limit or a warning to clear, with what they
// owe on invoices sent but not yet paid (due or not).
export const listCreditLimitAccounts = async (
  database: Reader,
): Promise<CreditLimitRow[]> => {
  const result = await database.query<CreditLimitRow>(
    `SELECT a.id, a.name, a.credit_limit_cents, a.credit_limit_warned_at,
            coalesce((SELECT sum(${OUTSTANDING}) FROM billing.invoices i
                      WHERE i.billing_account_id = a.id AND ${UNPAID}
                        AND i.kind <> 'personal'), 0) AS unpaid_cents
     FROM billing.billing_accounts a
     WHERE a.deleted_at IS NULL
       AND (a.credit_limit_cents IS NOT NULL OR a.credit_limit_warned_at IS NOT NULL)`,
  );
  return result.rows;
};

// true when this call changed the flag (so only one container warns).
export const setCreditLimitWarned = async (
  database: Reader,
  billingAccountId: string,
  warned: boolean,
): Promise<boolean> => {
  const result = await database.query(
    warned
      ? `UPDATE billing.billing_accounts SET credit_limit_warned_at = now()
         WHERE id = $1 AND credit_limit_warned_at IS NULL`
      : `UPDATE billing.billing_accounts SET credit_limit_warned_at = NULL
         WHERE id = $1 AND credit_limit_warned_at IS NOT NULL`,
    [billingAccountId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const setSuspension = async (
  client: PoolClient,
  billingAccountId: string,
  reason: string | null,
): Promise<{ suspended_at: Date | null } | undefined> => {
  const result = await client.query<{ suspended_at: Date | null }>(
    `UPDATE billing.billing_accounts
     SET suspended_at = CASE WHEN $2::text IS NULL THEN NULL ELSE coalesce(suspended_at, now()) END,
         suspension_reason = $2, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING suspended_at`,
    [billingAccountId, reason],
  );
  return result.rows[0];
};
