import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillableInterval } from '../billingCalendar/billableInterval';
import { DailyBillableCount } from './monthlyRunTypes';

type BillingReader = Pick<ServiceDatabaseService, 'query'>;

export interface RunAccountRow {
  id: string;
  timezone: string;
}

// Organisation billing accounts. Personal TECH accounts pay up front
// through /me/billing and never go through the monthly run.
export const listRunAccounts = async (
  client: BillingReader,
): Promise<RunAccountRow[]> => {
  const result = await client.query<RunAccountRow>(
    `SELECT a.id, a.timezone FROM billing.billing_accounts a
     WHERE a.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM billing.personal_accounts p
                       WHERE p.billing_account_id = a.id)
     ORDER BY a.id`,
  );
  return result.rows;
};

const toIntervals = (
  rows: { started_on: string; billing_end: string | null }[],
): BillableInterval[] =>
  rows.map((row) => ({
    startedOn: row.started_on,
    billingEnd: row.billing_end,
  }));

// Machine activations and TECH seats that overlap [from, until).
export const listBillableIntervals = async (
  client: BillingReader,
  billingAccountId: string,
  from: string,
  until: string,
): Promise<{ machines: BillableInterval[]; seats: BillableInterval[] }> => {
  const params = [billingAccountId, from, until];
  const machines = await client.query<{
    started_on: string;
    billing_end: string | null;
  }>(
    `SELECT activated_on::text AS started_on, billing_end::text
     FROM billing.machine_activations
     WHERE billing_account_id = $1 AND deleted_at IS NULL
       AND activated_on < $3::date AND (billing_end IS NULL OR billing_end > $2::date)`,
    params,
  );
  const seats = await client.query<{
    started_on: string;
    billing_end: string | null;
  }>(
    `SELECT started_on::text, billing_end::text FROM billing.seats
     WHERE billing_account_id = $1 AND deleted_at IS NULL
       AND started_on < $3::date AND (billing_end IS NULL OR billing_end > $2::date)`,
    params,
  );
  return {
    machines: toIntervals(machines.rows),
    seats: toIntervals(seats.rows),
  };
};

// A written day is never rewritten: the snapshot is what the month's
// invoice was based on.
export const insertDailyCounts = async (
  client: PoolClient,
  billingAccountId: string,
  counts: DailyBillableCount[],
): Promise<void> => {
  if (counts.length === 0) return;
  await client.query(
    `INSERT INTO billing.daily_billable_counts
       (billing_account_id, day, active_machines, tech_seats)
     SELECT $1, day, machines, seats
     FROM unnest($2::date[], $3::int[], $4::int[]) AS t(day, machines, seats)
     ON CONFLICT (billing_account_id, day) DO NOTHING`,
    [
      billingAccountId,
      counts.map((count) => count.day),
      counts.map((count) => count.activeMachines),
      counts.map((count) => count.techSeats),
    ],
  );
};

export const listDailyCounts = async (
  client: BillingReader,
  billingAccountId: string,
  from: string,
  until: string,
): Promise<DailyBillableCount[]> => {
  const result = await client.query<{
    day: string;
    active_machines: number;
    tech_seats: number;
  }>(
    `SELECT day::text, active_machines, tech_seats
     FROM billing.daily_billable_counts
     WHERE billing_account_id = $1 AND day >= $2::date AND day < $3::date
       AND deleted_at IS NULL
     ORDER BY day`,
    [billingAccountId, from, until],
  );
  return result.rows.map((row) => ({
    day: row.day,
    activeMachines: row.active_machines,
    techSeats: row.tech_seats,
  }));
};
