import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import {
  CancellationPlan,
  SubscriptionRow,
  SubscriptionTermPlan,
} from './subscriptionTypes';

const SUBSCRIPTION_COLUMNS = `id, billing_account_id, plan_code, price_book_id,
  term, committed_qty, annual_months_charged, contract_annual_cents, status,
  started_at, current_period_start, current_period_end, cancel_at,
  export_until, delete_after`;

const LIVE = `status <> 'cancelled' AND deleted_at IS NULL`;

export const findSubscriptionById = async (
  serviceDatabase: ServiceDatabaseService,
  subscriptionId: string,
): Promise<SubscriptionRow | undefined> => {
  const result = await serviceDatabase.query<SubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM billing.subscriptions
     WHERE id = $1 AND deleted_at IS NULL`,
    [subscriptionId],
  );
  return result.rows[0];
};

export const listLiveSubscriptions = async (
  serviceDatabase: ServiceDatabaseService,
  billingAccountId: string,
): Promise<SubscriptionRow[]> => {
  const result = await serviceDatabase.query<SubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM billing.subscriptions
     WHERE billing_account_id = $1 AND ${LIVE}
     ORDER BY plan_code`,
    [billingAccountId],
  );
  return result.rows;
};

// Inside a transaction: locks the live row so two changes can't race.
export const lockLiveSubscription = async (
  client: PoolClient,
  billingAccountId: string,
  planCode: string,
): Promise<SubscriptionRow | undefined> => {
  const result = await client.query<SubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM billing.subscriptions
     WHERE billing_account_id = $1 AND plan_code = $2 AND ${LIVE}
     FOR UPDATE`,
    [billingAccountId, planCode],
  );
  return result.rows[0];
};

export const insertSubscription = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    planCode: string;
    plan: SubscriptionTermPlan;
    contractAnnualCents: number | null;
    createdBy: string | null;
  },
): Promise<SubscriptionRow> => {
  const { plan } = params;
  const result = await client.query<SubscriptionRow>(
    `INSERT INTO billing.subscriptions
       (billing_account_id, plan_code, price_book_id, term, committed_qty,
        annual_months_charged, contract_annual_cents, current_period_start,
        current_period_end, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [
      params.billingAccountId,
      params.planCode,
      plan.priceBookId,
      plan.term,
      plan.committedQty,
      plan.annualMonthsCharged,
      params.contractAnnualCents,
      plan.periodStart,
      plan.periodEnd,
      params.createdBy,
    ],
  );
  return result.rows[0];
};

// Renewal: the next period with its newly pinned price book and Q.
export const applyRenewal = async (
  client: PoolClient,
  subscriptionId: string,
  plan: SubscriptionTermPlan,
): Promise<SubscriptionRow> => {
  const result = await client.query<SubscriptionRow>(
    `UPDATE billing.subscriptions
     SET price_book_id = $2, committed_qty = $3, annual_months_charged = $4,
         current_period_start = $5, current_period_end = $6, updated_at = now()
     WHERE id = $1
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [
      subscriptionId,
      plan.priceBookId,
      plan.committedQty,
      plan.annualMonthsCharged,
      plan.periodStart,
      plan.periodEnd,
    ],
  );
  return result.rows[0];
};

export const markCancelling = async (
  client: PoolClient,
  subscriptionId: string,
  plan: CancellationPlan,
): Promise<SubscriptionRow> => {
  const result = await client.query<SubscriptionRow>(
    `UPDATE billing.subscriptions
     SET status = 'cancelling', cancel_at = $2, export_until = $3,
         delete_after = $4, updated_at = now()
     WHERE id = $1
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [subscriptionId, plan.cancelAt, plan.exportUntil, plan.deleteAfter],
  );
  return result.rows[0];
};

// Ends a subscription replaced by another (e.g. self-serve → Enterprise).
// Not a customer cancellation, so no export or deletion is scheduled.
export const endReplacedSubscription = async (
  client: PoolClient,
  subscriptionId: string,
  endDay: string,
): Promise<void> => {
  await client.query(
    `UPDATE billing.subscriptions
     SET status = 'cancelled', cancel_at = $2, cancelled_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [subscriptionId, endDay],
  );
};
