import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

export type TransferStatus =
  'requested' | 'rejected' | 'cancelled' | 'completed';
export type TransferDirection = 'incoming' | 'outgoing';

export interface MachineSummary {
  label: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
}

export interface TransferRow {
  id: string;
  machine_id: string;
  from_tenant_id: string;
  from_tenant_name: string;
  to_tenant_id: string;
  to_tenant_name: string;
  status: TransferStatus;
  reason: string;
  machine_summary: MachineSummary;
  requested_at: Date;
  decided_at: Date | null;
  decision_note: string | null;
}

const TRANSFER_SELECT = `
  SELECT t.id, t.machine_id, t.from_tenant_id, ft.name AS from_tenant_name,
         t.to_tenant_id, tt.name AS to_tenant_name, t.status, t.reason,
         t.machine_summary, t.requested_at, t.decided_at, t.decision_note
  FROM billing.machine_transfers t
  JOIN tenants ft ON ft.id = t.from_tenant_id
  JOIN tenants tt ON tt.id = t.to_tenant_id`;

// The receiving organisation, named by the slug its administrator shares
// (organisations aren't listed to each other).
export const findOrganisationBySlug = async (
  serviceDatabase: ServiceDatabaseService,
  slug: string,
): Promise<{ id: string; name: string } | undefined> => {
  const result = await serviceDatabase.query<{ id: string; name: string }>(
    `SELECT id, name FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [slug],
  );
  return result.rows[0];
};

export const listTransfers = async (
  serviceDatabase: ServiceDatabaseService,
  tenantId: string,
  direction: TransferDirection,
): Promise<TransferRow[]> => {
  const column = direction === 'incoming' ? 'to_tenant_id' : 'from_tenant_id';
  const result = await serviceDatabase.query<TransferRow>(
    `${TRANSFER_SELECT}
     WHERE t.${column} = $1 AND t.deleted_at IS NULL
     ORDER BY t.status <> 'requested', t.requested_at DESC`,
    [tenantId],
  );
  return result.rows;
};

// Completed transfers of one machine, oldest first: its chain of custody.
export const listCompletedTransfers = async (
  serviceDatabase: ServiceDatabaseService,
  machineId: string,
): Promise<TransferRow[]> => {
  const result = await serviceDatabase.query<TransferRow>(
    `${TRANSFER_SELECT}
     WHERE t.machine_id = $1 AND t.status = 'completed' AND t.deleted_at IS NULL
     ORDER BY t.decided_at`,
    [machineId],
  );
  return result.rows;
};

export const insertTransfer = async (
  client: PoolClient,
  params: {
    machineId: string;
    fromTenantId: string;
    toTenantId: string;
    reason: string;
    machineSummary: MachineSummary;
    requestedBy: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.machine_transfers
       (machine_id, from_tenant_id, to_tenant_id, reason, machine_summary, requested_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.machineId,
      params.fromTenantId,
      params.toTenantId,
      params.reason,
      params.machineSummary,
      params.requestedBy,
    ],
  );
  return result.rows[0].id;
};

export const lockTransfer = async (
  client: PoolClient,
  transferId: string,
): Promise<
  | {
      id: string;
      machine_id: string;
      from_tenant_id: string;
      to_tenant_id: string;
      status: TransferStatus;
    }
  | undefined
> => {
  const result = await client.query<{
    id: string;
    machine_id: string;
    from_tenant_id: string;
    to_tenant_id: string;
    status: TransferStatus;
  }>(
    `SELECT id, machine_id, from_tenant_id, to_tenant_id, status
     FROM billing.machine_transfers
     WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [transferId],
  );
  return result.rows[0];
};

export const recordTransferDecision = async (
  client: PoolClient,
  params: {
    transferId: string;
    status: Exclude<TransferStatus, 'requested'>;
    decidedBy: string;
    note: string | null;
  },
): Promise<void> => {
  await client.query(
    `UPDATE billing.machine_transfers
     SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4,
         updated_at = now()
     WHERE id = $1`,
    [params.transferId, params.status, params.decidedBy, params.note],
  );
};

// The seller's billing account and time zone, from the machine's open
// activation interval: the buyer can't read the seller's machine itself.
export const findSellerActivation = async (
  client: PoolClient,
  machineId: string,
): Promise<{ billing_account_id: string; timezone: string } | undefined> => {
  const result = await client.query<{
    billing_account_id: string;
    timezone: string;
  }>(
    `SELECT a.id AS billing_account_id, a.timezone
     FROM billing.machine_activations ma
     JOIN billing.billing_accounts a ON a.id = ma.billing_account_id
     WHERE ma.machine_id = $1 AND ma.billing_end IS NULL
       AND ma.deleted_at IS NULL`,
    [machineId],
  );
  return result.rows[0];
};

// Moves the machine to the buyer through billing.complete_machine_transfer
// (migration 0100). false when the transfer isn't pending any more or the
// machine has left active.
export const completeMachineTransfer = async (
  client: PoolClient,
  params: {
    transferId: string;
    billingEnd: string;
    actorUserId: string;
    reason: string | null;
  },
): Promise<boolean> => {
  const result = await client.query<{ completed: boolean }>(
    `SELECT billing.complete_machine_transfer($1, $2, $3, $4) AS completed`,
    [params.transferId, params.billingEnd, params.actorUserId, params.reason],
  );
  return result.rows[0]?.completed === true;
};
