import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { MACHINE_FINAL_INVOICE_KIND } from '../billing/monthlyRun/runInvoices.repository';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import {
  BillingIntervalUse,
  DeletionInvoice,
  FinalChargeQuote,
  MachinePlanBilling,
} from './machineDeletionRules';

// Tenant role (RLS): billing rows are the caller's own billing account only.

export const countOpenCases = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<number> => {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM support_cases
     WHERE machine_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       AND status IN ('new', 'open', 'waiting_on_customer')`,
    [machineId, tenantId],
  );
  return result.rows[0].count;
};

export const hasPendingTransfer = async (
  client: PoolClient,
  machineId: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM billing.machine_transfers
     WHERE machine_id = $1 AND status = 'requested' AND deleted_at IS NULL`,
    [machineId],
  );
  return (result.rowCount ?? 0) > 0;
};

// The day it was deactivated is worked out in the account's time zone.
export const listBillingIntervals = async (
  client: PoolClient,
  machineId: string,
  timezone: string,
): Promise<BillingIntervalUse[]> => {
  const result = await client.query<{
    activated_on: string;
    billing_end: string | null;
    last_used_on: string | null;
  }>(
    `SELECT activated_on::text, billing_end::text,
            ((deactivation_requested_at AT TIME ZONE $2)::date)::text AS last_used_on
     FROM billing.machine_activations
     WHERE machine_id = $1 AND deleted_at IS NULL`,
    [machineId, timezone],
  );
  return result.rows.map((row) => ({
    activatedOn: row.activated_on,
    billingEnd: row.billing_end,
    lastUsedOn: row.last_used_on,
  }));
};

// The account's monthly invoices and this machine's final charges for the
// months a machine was billed, oldest first.
export const listSettlementInvoices = async (
  client: PoolClient,
  machineId: string,
  firstMonth: string,
  lastMonth: string,
): Promise<DeletionInvoice[]> => {
  const result = await client.query<{
    id: string;
    period_start: string;
    status: string;
    total_ex_gst_cents: string;
    hosted_invoice_url: string | null;
    kind: string;
  }>(
    `SELECT i.id, i.period_start::text, i.status, i.total_ex_gst_cents,
            i.hosted_invoice_url, i.kind
     FROM billing.invoices i
     WHERE i.billing_account_id = current_billing_account_id()
       AND i.status <> 'void'
       AND i.period_start BETWEEN $2::date AND $3::date
       AND (i.kind = 'monthly' OR i.id IN (
         SELECT c.invoice_id FROM billing.machine_final_charges c WHERE c.machine_id = $1))
     ORDER BY i.period_start, i.created_at`,
    [machineId, firstMonth, lastMonth],
  );
  return result.rows.map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    status: row.status,
    totalExGstCents: Number(row.total_ex_gst_cents),
    hostedInvoiceUrl: row.hosted_invoice_url,
    isFinalCharge: row.kind === MACHINE_FINAL_INVOICE_KIND,
  }));
};

// How the machine is billed, from the account's live plan.
export const findMachinePlanBilling = async (
  client: PoolClient,
): Promise<MachinePlanBilling> => {
  const result = await client.query<{ term: string }>(
    `SELECT term FROM billing.subscriptions
     WHERE billing_account_id = current_billing_account_id()
       AND plan_code = 'ASSET_PRO' AND status <> 'cancelled' AND deleted_at IS NULL
     LIMIT 1`,
  );
  const term = result.rows[0]?.term;
  if (term === 'monthly') return 'monthly';
  return term ? 'annual' : 'none';
};

export const findMachineLabel = async (
  client: PoolClient,
  machineId: string,
): Promise<string> => {
  const result = await client.query<{ label: string }>(
    `SELECT ${MACHINE_LABEL_SQL} AS label FROM machines m WHERE m.id = $1`,
    [machineId],
  );
  return result.rows[0]?.label ?? machineId;
};

export const hasDailySnapshot = async (
  client: PoolClient,
  day: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM billing.daily_billable_counts
     WHERE billing_account_id = current_billing_account_id()
       AND day = $1::date AND deleted_at IS NULL`,
    [day],
  );
  return (result.rowCount ?? 0) > 0;
};

export const listFinalChargedMonths = async (
  client: PoolClient,
  machineId: string,
): Promise<string[]> => {
  const result = await client.query<{ period_start: string }>(
    `SELECT c.period_start::text AS period_start
     FROM billing.machine_final_charges c
     JOIN billing.invoices i ON i.id = c.invoice_id AND i.status <> 'void'
     WHERE c.machine_id = $1`,
    [machineId],
  );
  return result.rows.map((row) => row.period_start);
};

// False if the machine has changed state since it was checked.
export const softDeleteMachine = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; lifecycleState: string },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE machines SET deleted_at = now()
     WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = $3 AND deleted_at IS NULL`,
    [params.machineId, params.tenantId, params.lifecycleState],
  );
  return (result.rowCount ?? 0) > 0;
};

// Service role, under the run's per-account lock, so a charge can't be raised
// twice or while the run is working on that account.
export const lockAccountBilling = async (
  client: PoolClient,
  billingAccountId: string,
): Promise<void> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `billing-run:${billingAccountId}`,
  ]);
};

export const hasLiveFinalCharge = async (
  client: Pick<ServiceDatabaseService, 'query'>,
  machineId: string,
  periodStart: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM billing.machine_final_charges c
     JOIN billing.invoices i ON i.id = c.invoice_id AND i.status <> 'void'
     WHERE c.machine_id = $1 AND c.period_start = $2::date`,
    [machineId, periodStart],
  );
  return (result.rowCount ?? 0) > 0;
};

export const insertFinalCharge = async (
  client: PoolClient,
  params: {
    machineId: string;
    billingAccountId: string;
    invoiceId: string;
    quote: FinalChargeQuote;
  },
): Promise<void> => {
  const { quote } = params;
  await client.query(
    `INSERT INTO billing.machine_final_charges
       (machine_id, billing_account_id, invoice_id, period_start, last_used_on,
        days_used, days_in_month, rate_cents, amount_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.machineId,
      params.billingAccountId,
      params.invoiceId,
      quote.periodStart,
      quote.lastUsedOn,
      quote.daysUsed,
      quote.daysInMonth,
      quote.monthlyRateCents,
      quote.amountCents,
    ],
  );
};
