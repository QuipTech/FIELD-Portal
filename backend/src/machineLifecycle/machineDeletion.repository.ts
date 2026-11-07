import { PoolClient } from 'pg';
import { DeletionInvoice } from './machineDeletionRules';

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

export const listBillingIntervals = async (
  client: PoolClient,
  machineId: string,
): Promise<{ activatedOn: string; billingEnd: string | null }[]> => {
  const result = await client.query<{
    activated_on: string;
    billing_end: string | null;
  }>(
    `SELECT activated_on::text, billing_end::text
     FROM billing.machine_activations
     WHERE machine_id = $1 AND deleted_at IS NULL`,
    [machineId],
  );
  return result.rows.map((row) => ({
    activatedOn: row.activated_on,
    billingEnd: row.billing_end,
  }));
};

// Monthly invoices for the months a machine was billed, oldest first.
export const listMonthlyInvoices = async (
  client: PoolClient,
  firstMonth: string,
  lastMonth: string,
): Promise<DeletionInvoice[]> => {
  const result = await client.query<{
    id: string;
    period_start: string;
    status: string;
    total_ex_gst_cents: string;
    hosted_invoice_url: string | null;
  }>(
    `SELECT id, period_start::text, status, total_ex_gst_cents, hosted_invoice_url
     FROM billing.invoices
     WHERE billing_account_id = current_billing_account_id()
       AND kind = 'monthly' AND status <> 'void'
       AND period_start BETWEEN $1::date AND $2::date
     ORDER BY period_start`,
    [firstMonth, lastMonth],
  );
  return result.rows.map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    status: row.status,
    totalExGstCents: Number(row.total_ex_gst_cents),
    hostedInvoiceUrl: row.hosted_invoice_url,
  }));
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
