import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AllowanceMetric, ThresholdState } from './allowanceRules';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface AllowanceAccountRow {
  id: string;
  timezone: string;
}

export interface AllowancePeriodRow {
  id: string;
  period_start: string;
  metric: AllowanceMetric;
  allowance: string;
  used: string;
  threshold_state: ThresholdState;
  consecutive_over: number;
  closed_at: Date | null;
}

// Organisation accounts with a live plan that isn't INTERNAL (QuipTech's
// own and demo organisations are metered but never held to an allowance).
export const listAllowanceAccounts = async (
  database: Reader,
): Promise<AllowanceAccountRow[]> => {
  const result = await database.query<AllowanceAccountRow>(
    `SELECT a.id, a.timezone FROM billing.billing_accounts a
     WHERE a.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM billing.personal_accounts p WHERE p.billing_account_id = a.id)
       AND EXISTS (SELECT 1 FROM billing.subscriptions s
                   WHERE s.billing_account_id = a.id AND s.deleted_at IS NULL
                     AND s.status <> 'cancelled' AND s.plan_code <> 'INTERNAL')
     ORDER BY a.id`,
  );
  return result.rows;
};

// Average active machines over [monthStart, until): daily snapshots where
// written, today's count otherwise.
export const findAverageActiveMachines = async (
  database: Reader,
  billingAccountId: string,
  monthStart: string,
  until: string,
): Promise<number> => {
  const result = await database.query<{ average: string | null }>(
    `SELECT avg(count) AS average FROM (
       SELECT count(DISTINCT a.machine_id) AS count
       FROM generate_series($2::date, ($3::date - 1), interval '1 day') AS d(day)
       LEFT JOIN billing.machine_activations a
         ON a.billing_account_id = $1 AND a.deleted_at IS NULL
        AND a.activated_on <= d.day AND (a.billing_end IS NULL OR d.day < a.billing_end)
       GROUP BY d.day
     ) daily`,
    [billingAccountId, monthStart, until],
  );
  return Number(result.rows[0]?.average ?? 0);
};

// TECH seats held on the account plus users of its organisations with a
// paid personal TECH month.
export const countTechUsers = async (
  database: Reader,
  billingAccountId: string,
  monthStart: string,
): Promise<number> => {
  const result = await database.query<{ count: string }>(
    `SELECT (
       SELECT count(*) FROM billing.seats s
       WHERE s.billing_account_id = $1 AND s.deleted_at IS NULL
         AND s.started_on <= $2::date AND (s.billing_end IS NULL OR $2::date < s.billing_end)
     ) + (
       SELECT count(DISTINCT p.user_id) FROM billing.personal_periods p
       JOIN billing.invoices i ON i.id = p.invoice_id AND i.status = 'paid'
       JOIN tenants t ON t.id = p.tenant_id AND t.billing_account_id = $1
       WHERE p.period_start = $2::date AND p.deleted_at IS NULL AND p.replaced_at IS NULL
     ) AS count`,
    [billingAccountId, monthStart],
  );
  return Number(result.rows[0]?.count ?? 0);
};

// Use in [from, until) in the account's time zone: AI turns (each
// technician question, ai_query, recorded by trigger since the first
// deployment) and pages ingested; storage is everything still stored.
export const measureUse = async (
  database: Reader,
  params: {
    billingAccountId: string;
    timezone: string;
    monthStart: string;
    until: string;
  },
): Promise<Record<AllowanceMetric, number>> => {
  const result = await database.query<{
    ai_turns: string;
    storage_bytes: string;
    ingest_pages: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE event_type = 'ai_query'
         AND occurred_at >= ($3::timestamp AT TIME ZONE $2)
         AND occurred_at < ($4::timestamp AT TIME ZONE $2)) AS ai_turns,
       coalesce(sum(quantity) FILTER (WHERE event_type = 'storage.delta'), 0) AS storage_bytes,
       coalesce(sum(quantity) FILTER (WHERE event_type = 'doc.ingest'
         AND occurred_at >= ($3::timestamp AT TIME ZONE $2)
         AND occurred_at < ($4::timestamp AT TIME ZONE $2)), 0) AS ingest_pages
     FROM app.usage_events WHERE billing_account_id = $1`,
    [params.billingAccountId, params.timezone, params.monthStart, params.until],
  );
  const row = result.rows[0];
  return {
    ai_turns: Number(row?.ai_turns ?? 0),
    storage_bytes: Math.max(Number(row?.storage_bytes ?? 0), 0),
    ingest_pages: Number(row?.ingest_pages ?? 0),
  };
};

export const listPeriods = async (
  database: Reader,
  billingAccountId: string,
  periodStarts: string[],
): Promise<AllowancePeriodRow[]> => {
  const result = await database.query<AllowancePeriodRow>(
    `SELECT id, period_start::text, metric, allowance, used, threshold_state,
            consecutive_over, closed_at
     FROM billing.allowance_periods
     WHERE billing_account_id = $1 AND period_start = ANY($2::date[]) AND deleted_at IS NULL`,
    [billingAccountId, periodStarts],
  );
  return result.rows;
};

// Saves the month's figures so far (the threshold is moved separately).
export const upsertPeriod = async (
  database: Reader,
  params: {
    billingAccountId: string;
    periodStart: string;
    metric: AllowanceMetric;
    allowance: number;
    used: number;
  },
): Promise<void> => {
  await database.query(
    `INSERT INTO billing.allowance_periods
       (billing_account_id, period_start, metric, allowance, used)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (billing_account_id, period_start, metric) DO UPDATE
     SET allowance = EXCLUDED.allowance, used = EXCLUDED.used, updated_at = now()
     WHERE billing.allowance_periods.closed_at IS NULL`,
    [
      params.billingAccountId,
      params.periodStart,
      params.metric,
      params.allowance,
      params.used,
    ],
  );
};

// Moves the threshold from `from` to `to`. True only for the one caller
// that moved it, so a notice is sent once even with several API containers.
export const advanceThreshold = async (
  database: Reader,
  params: {
    billingAccountId: string;
    periodStart: string;
    metric: AllowanceMetric;
    from: ThresholdState;
    to: ThresholdState;
  },
): Promise<boolean> => {
  const result = await database.query(
    `UPDATE billing.allowance_periods SET threshold_state = $5, updated_at = now()
     WHERE billing_account_id = $1 AND period_start = $2 AND metric = $3
       AND threshold_state = $4 AND closed_at IS NULL`,
    [
      params.billingAccountId,
      params.periodStart,
      params.metric,
      params.from,
      params.to,
    ],
  );
  return (result.rowCount ?? 0) > 0;
};

export const closePeriod = async (
  database: Reader,
  periodId: string,
  values: { allowance: number; used: number; consecutiveOver: number },
): Promise<boolean> => {
  const result = await database.query(
    `UPDATE billing.allowance_periods
     SET allowance = $2, used = $3, consecutive_over = $4, closed_at = now(), updated_at = now()
     WHERE id = $1 AND closed_at IS NULL`,
    [periodId, values.allowance, values.used, values.consecutiveOver],
  );
  return (result.rowCount ?? 0) > 0;
};

// The organisation's own months, for its billing page (RLS: own account).
export const listCurrentPeriods = async (
  database: Reader,
  billingAccountId: string,
  periodStart: string,
): Promise<AllowancePeriodRow[]> =>
  listPeriods(database, billingAccountId, [periodStart]);
