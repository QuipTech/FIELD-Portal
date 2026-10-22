import { PoolClient } from 'pg';
import { getRequestSource } from '../../common/requestSource/requestSource';

// Who made a billing change. null = a scheduled job (audited as 'system').
export interface BillingActor {
  userId: string;
  tenantId: string;
}

export interface BillingAuditEntry {
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  // null only for a change made by a person outside any billing account
  // (e.g. a receiving organisation deciding on a transfer).
  billingAccountId: string | null;
  // Every change that affects money or access records from, to and reason.
  from: unknown;
  to: unknown;
  reason: string | null;
  metadata?: Record<string, unknown>;
}

// A job has no organisation of its own, so its entry goes to the account's
// first organisation, where that account's admins can see it.
const findAuditTenantId = async (
  client: PoolClient,
  actor: BillingActor | null,
  billingAccountId: string | null,
): Promise<string> => {
  if (actor) return actor.tenantId;
  if (!billingAccountId) {
    throw new Error('A scheduled billing change must name its billing account');
  }
  const result = await client.query<{ id: string }>(
    `SELECT id FROM tenants WHERE billing_account_id = $1 AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1`,
    [billingAccountId],
  );
  const tenantId = result.rows[0]?.id;
  if (!tenantId) {
    throw new Error(`Billing account ${billingAccountId} has no organisation`);
  }
  return tenantId;
};

// Writes the audit entry inside the caller's service-role transaction, so
// a change is never saved without it (billing.record_audit_entry, 0096).
export const recordBillingAudit = async (
  client: PoolClient,
  actor: BillingActor | null,
  entry: BillingAuditEntry,
): Promise<void> => {
  const tenantId = await findAuditTenantId(
    client,
    actor,
    entry.billingAccountId,
  );
  await client.query(
    `SELECT billing.record_audit_entry($1, $2, $3, $4, $5, $6, $7)`,
    [
      tenantId,
      actor?.userId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId,
      {
        billingAccountId: entry.billingAccountId,
        from: entry.from,
        to: entry.to,
        reason: entry.reason,
        ...entry.metadata,
      },
      actor ? (getRequestSource() ?? null) : 'system',
    ],
  );
};
