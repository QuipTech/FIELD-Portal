import { PoolClient } from 'pg';
import { BillingAccountRow } from './types/billingAccountRows';

export interface BillingAccountDetailChanges {
  name?: string;
  abn?: string | null;
  billingEmail?: string;
  billingContactName?: string | null;
  timezone?: string;
}

const RETURNED_COLUMNS = `id, name, abn, billing_email, timezone, currency,
  stripe_customer_id, partner_id, billing_contact_name, suspended_at,
  suspension_reason, created_at, updated_at, row_version`;

export type LockedBillingAccountRow = BillingAccountRow & {
  row_version: number;
};

export const lockBillingAccount = async (
  client: PoolClient,
  billingAccountId: string,
): Promise<LockedBillingAccountRow | undefined> => {
  const result = await client.query<LockedBillingAccountRow>(
    `SELECT ${RETURNED_COLUMNS} FROM billing.billing_accounts
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [billingAccountId],
  );
  return result.rows[0];
};

// Only the fields present in `changes` are written; COALESCE can't be used
// because abn and the contact name may be cleared to NULL.
export const updateBillingAccountDetails = async (
  client: PoolClient,
  billingAccountId: string,
  changes: BillingAccountDetailChanges,
): Promise<LockedBillingAccountRow> => {
  const columns: [string, unknown][] = [
    ['name', changes.name],
    ['abn', changes.abn],
    ['billing_email', changes.billingEmail],
    ['billing_contact_name', changes.billingContactName],
    ['timezone', changes.timezone],
  ];
  const present = columns.filter(([, value]) => value !== undefined);
  const assignments = present.map(
    ([column], index) => `${column} = $${index + 2}`,
  );
  const result = await client.query<LockedBillingAccountRow>(
    `UPDATE billing.billing_accounts
     SET ${[...assignments, 'updated_at = now()'].join(', ')}
     WHERE id = $1
     RETURNING ${RETURNED_COLUMNS}`,
    [billingAccountId, ...present.map(([, value]) => value)],
  );
  return result.rows[0];
};

// Attaches an organisation that has no billing account yet. 0 rows = the
// organisation doesn't exist or already belongs to an account.
export const attachOrganisation = async (
  client: PoolClient,
  billingAccountId: string,
  organisationId: string,
): Promise<number> => {
  const result = await client.query(
    `UPDATE tenants SET billing_account_id = $1
     WHERE id = $2 AND billing_account_id IS NULL AND deleted_at IS NULL`,
    [billingAccountId, organisationId],
  );
  return result.rowCount ?? 0;
};
