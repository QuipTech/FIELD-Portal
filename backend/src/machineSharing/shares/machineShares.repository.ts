import { PoolClient } from 'pg';
import {
  AssignmentTargetType,
  ShareAccessLevel,
} from '../types/machineGroupTypes';

export interface MachineShareRow {
  assignment_id: string;
  group_id: string;
  group_name: string;
  group_colour: string | null;
  target_type: AssignmentTargetType;
  target_name: string;
  organisation_name: string;
  access_level: ShareAccessLevel;
  granted_at: Date;
  withdrawn_at: Date | null;
  withdrawn_reason: string | null;
}

// Every assignment that reaches one of the caller's organisation's own
// machines (owned_machine_shares(), migration 0119: nothing for a machine
// it doesn't own).
export const listOwnedMachineShares = async (
  client: PoolClient,
  machineId: string,
): Promise<MachineShareRow[]> => {
  const result = await client.query<MachineShareRow>(
    'SELECT * FROM owned_machine_shares($1)',
    [machineId],
  );
  return result.rows;
};

// Withdraws the machine from that one assignment (RLS: own machines only).
export const insertShareExclusion = async (
  client: PoolClient,
  params: {
    tenantId: string;
    assignmentId: string;
    machineId: string;
    revokedBy: string;
    reason: string;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO machine_share_exclusions
       (tenant_id, assignment_id, machine_id, revoked_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.tenantId,
      params.assignmentId,
      params.machineId,
      params.revokedBy,
      params.reason,
    ],
  );
};

// Tells every platform administrator (notify_machine_share_revoked, 0119).
export const notifyShareRevoked = async (
  client: PoolClient,
  params: { machineId: string; groupId: string; reason: string },
): Promise<void> => {
  await client.query('SELECT notify_machine_share_revoked($1, $2, $3)', [
    params.machineId,
    params.groupId,
    params.reason,
  ]);
};
