import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface OverdueInvoiceRow {
  id: string;
  billing_account_id: string;
  account_name: string;
  billing_email: string;
  timezone: string;
  due_on: string;
  total_cents: string | null;
  amount_paid_cents: string;
  hosted_invoice_url: string | null;
  overdue_notice_1_at: Date | null;
  overdue_notice_7_at: Date | null;
}

// Organisation invoices still unpaid after their due date. Personal TECH
// payments have their own prompt in the portal, so they are left out.
export const listUnpaidPastDue = async (
  database: Reader,
): Promise<OverdueInvoiceRow[]> => {
  const result = await database.query<OverdueInvoiceRow>(
    `SELECT i.id, i.billing_account_id, a.name AS account_name, a.billing_email,
            a.timezone, i.due_on::text, i.total_cents, i.amount_paid_cents,
            i.hosted_invoice_url, i.overdue_notice_1_at, i.overdue_notice_7_at
     FROM billing.invoices i
     JOIN billing.billing_accounts a ON a.id = i.billing_account_id
     WHERE i.status IN ('synced', 'payment_failed') AND i.due_on IS NOT NULL
       AND i.due_on < (now() AT TIME ZONE a.timezone)::date
       AND i.kind <> 'personal' AND a.deleted_at IS NULL
     ORDER BY i.due_on, i.id`,
  );
  return result.rows;
};

// Records a notice once; false when it was already recorded (another
// container got there first).
export const markNoticeSent = async (
  database: Reader,
  invoiceId: string,
  notice: 'day1' | 'day7',
): Promise<boolean> => {
  const column =
    notice === 'day1' ? 'overdue_notice_1_at' : 'overdue_notice_7_at';
  const result = await database.query(
    `UPDATE billing.invoices SET ${column} = now(), updated_at = now()
     WHERE id = $1 AND ${column} IS NULL AND status IN ('synced', 'payment_failed')`,
    [invoiceId],
  );
  return (result.rowCount ?? 0) > 0;
};

// The account's earliest first-notice still unpaid; null when none.
export const findFirstUnpaidNotice = async (
  database: Reader,
  billingAccountId: string,
): Promise<Date | null> => {
  const result = await database.query<{ first: Date | null }>(
    `SELECT min(overdue_notice_1_at) AS first FROM billing.invoices
     WHERE billing_account_id = $1 AND status IN ('synced', 'payment_failed')`,
    [billingAccountId],
  );
  return result.rows[0]?.first ?? null;
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
