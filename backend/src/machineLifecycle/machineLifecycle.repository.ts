import { PoolClient } from 'pg';

export interface LifecycleMachineRow {
  id: string;
  lifecycle_state: string;
  billing_account_id: string | null;
  timezone: string | null;
  suspended_at: Date | null;
}

export interface LifecycleEventRow {
  id: string;
  from_state: string;
  to_state: string;
  reason: string | null;
  occurred_at: Date;
  actor_first_name: string | null;
  actor_last_name: string | null;
  transfer_id: string | null;
}

// Tenant role (RLS): the machine with its organisation's billing account,
// which field_app can read for its own account (migration 0096).
export const findLifecycleMachine = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<LifecycleMachineRow | undefined> => {
  const result = await client.query<LifecycleMachineRow>(
    `SELECT m.id, m.lifecycle_state, a.id AS billing_account_id, a.timezone,
            a.suspended_at
     FROM machines m
     LEFT JOIN billing.billing_accounts a
       ON a.id = current_billing_account_id() AND a.deleted_at IS NULL
     WHERE m.tenant_id = $1 AND m.id = $2 AND m.deleted_at IS NULL`,
    [tenantId, machineId],
  );
  return result.rows[0];
};

// Newest first. The actor's name is shown only when they are in this
// organisation (users is RLS-scoped), e.g. not a previous owner's staff.
export const listLifecycleEvents = async (
  client: PoolClient,
  machineId: string,
): Promise<LifecycleEventRow[]> => {
  const result = await client.query<LifecycleEventRow>(
    `SELECT e.id, e.from_state, e.to_state, e.reason, e.occurred_at,
            u.first_name AS actor_first_name, u.last_name AS actor_last_name,
            e.transfer_id
     FROM billing.machine_lifecycle_events e
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.machine_id = $1 AND e.deleted_at IS NULL
     ORDER BY e.occurred_at DESC, e.id`,
    [machineId],
  );
  return result.rows;
};
