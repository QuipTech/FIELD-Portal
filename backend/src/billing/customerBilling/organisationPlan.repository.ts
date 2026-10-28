import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface OrganisationAccountRow {
  id: string;
  name: string;
  billing_email: string;
  timezone: string;
  suspended_at: Date | null;
  suspension_reason: string | null;
  stripe_customer_id: string | null;
}

export const findOrganisationAccountDetails = async (
  database: Reader,
  tenantId: string,
): Promise<OrganisationAccountRow | undefined> => {
  const result = await database.query<OrganisationAccountRow>(
    `SELECT a.id, a.name, a.billing_email, a.timezone, a.suspended_at,
            a.suspension_reason, a.stripe_customer_id
     FROM tenants t JOIN billing.billing_accounts a ON a.id = t.billing_account_id
     WHERE t.id = $1 AND a.deleted_at IS NULL`,
    [tenantId],
  );
  return result.rows[0];
};

// Machines active today and the month's peak so far (spec section 3).
export const findMachineCounts = async (
  database: Reader,
  billingAccountId: string,
  monthStart: string,
  today: string,
): Promise<{ activeToday: number; peakSoFar: number }> => {
  const result = await database.query<{
    active_today: string;
    peak: string | null;
  }>(
    `SELECT
       (SELECT count(DISTINCT machine_id) FROM billing.machine_activations
        WHERE billing_account_id = $1 AND deleted_at IS NULL
          AND activated_on <= $3::date AND (billing_end IS NULL OR $3::date < billing_end)) AS active_today,
       (SELECT max(daily.count) FROM (
          SELECT count(DISTINCT a.machine_id) AS count
          FROM generate_series($2::date, $3::date, interval '1 day') AS d(day)
          LEFT JOIN billing.machine_activations a
            ON a.billing_account_id = $1 AND a.deleted_at IS NULL
           AND a.activated_on <= d.day AND (a.billing_end IS NULL OR d.day < a.billing_end)
          GROUP BY d.day) daily) AS peak`,
    [billingAccountId, monthStart, today],
  );
  return {
    activeToday: Number(result.rows[0]?.active_today ?? 0),
    peakSoFar: Number(result.rows[0]?.peak ?? 0),
  };
};

// Unpaid invoices past their due date, and the first notice still open.
export const findOverdueSummary = async (
  database: Reader,
  billingAccountId: string,
): Promise<{
  count: number;
  amountCents: number;
  firstNoticeAt: Date | null;
}> => {
  const result = await database.query<{
    count: string;
    amount: string | null;
    first_notice: Date | null;
  }>(
    `SELECT count(*) AS count,
            sum(coalesce(total_cents, total_ex_gst_cents) - amount_paid_cents) AS amount,
            min(overdue_notice_1_at) AS first_notice
     FROM billing.invoices i JOIN billing.billing_accounts a ON a.id = i.billing_account_id
     WHERE i.billing_account_id = $1 AND i.status IN ('synced', 'payment_failed')
       AND i.due_on < (now() AT TIME ZONE a.timezone)::date`,
    [billingAccountId],
  );
  const row = result.rows[0];
  return {
    count: Number(row?.count ?? 0),
    amountCents: Number(row?.amount ?? 0),
    firstNoticeAt: row?.first_notice ?? null,
  };
};
