import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import {
  CancellationPlan,
  SubscriptionRow,
  SubscriptionTerm,
  SubscriptionTermPlan,
} from './subscriptionTypes';

const SUBSCRIPTION_COLUMNS = `id, billing_account_id, plan_code, price_book_id,
  term, committed_qty, annual_months_charged, contract_annual_cents, status,
  started_at, current_period_start, current_period_end, cancel_at,
  export_until, delete_after, next_term, next_committed_qty`;

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
         current_period_start = $5, current_period_end = $6, term = $7,
         next_term = NULL, next_committed_qty = NULL, updated_at = now()
     WHERE id = $1
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [
      subscriptionId,
      plan.priceBookId,
      plan.committedQty,
      plan.annualMonthsCharged,
      plan.periodStart,
      plan.periodEnd,
      plan.term,
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

// The term the customer wants from their next renewal (null = unchanged).
export const saveNextTerm = async (
  client: PoolClient,
  subscriptionId: string,
  next: { term: SubscriptionTerm | null; committedQty: number | null },
): Promise<SubscriptionRow> => {
  const result = await client.query<SubscriptionRow>(
    `UPDATE billing.subscriptions
     SET next_term = $2, next_committed_qty = $3, updated_at = now()
     WHERE id = $1
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [subscriptionId, next.term, next.committedQty],
  );
  return result.rows[0];
};

// Takes back a cancellation that hasn't taken effect yet.
export const undoCancelling = async (
  client: PoolClient,
  subscriptionId: string,
): Promise<SubscriptionRow | undefined> => {
  const result = await client.query<SubscriptionRow>(
    `UPDATE billing.subscriptions
     SET status = 'active', cancel_at = NULL, export_until = NULL,
         delete_after = NULL, updated_at = now()
     WHERE id = $1 AND status = 'cancelling'
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [subscriptionId],
  );
  return result.rows[0];
};

// The cancellation has taken effect (cancel_at reached).
export const markCancelled = async (
  client: PoolClient,
  subscriptionId: string,
): Promise<void> => {
  await client.query(
    `UPDATE billing.subscriptions
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'cancelling'`,
    [subscriptionId],
  );
};

// Live subscriptions whose period has ended by `today`: renew them, or
// end them if they were cancelling. Enterprise contracts are quoted and
// renewed by hand, so they are left alone.
export const listSubscriptionsDue = async (
  client: Pick<ServiceDatabaseService, 'query'>,
  billingAccountId: string,
  today: string,
): Promise<SubscriptionRow[]> => {
  const result = await client.query<SubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM billing.subscriptions
     WHERE billing_account_id = $1 AND deleted_at IS NULL
       AND status IN ('active', 'cancelling') AND plan_code <> 'ENTERPRISE'
       AND current_period_end <= $2::date
     ORDER BY plan_code, id`,
    [billingAccountId, today],
  );
  return result.rows;
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
