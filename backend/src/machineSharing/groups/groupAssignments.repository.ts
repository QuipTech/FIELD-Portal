import { PoolClient } from 'pg';
import {
  AssignmentTargetType,
  ShareAccessLevel,
} from '../types/machineGroupTypes';

// Who a group is shared with. Only the platform administrator writes
// assignments (RLS); a revoked one is kept with who, when and why.

export interface AssignmentRow {
  id: string;
  target_type: AssignmentTargetType;
  target_id: string;
  target_name: string;
  target_email: string | null;
  organisation_id: string;
  organisation_name: string;
  access_level: ShareAccessLevel;
  granted_by_name: string | null;
  granted_at: Date;
}

// Active assignments with the names of whoever has them (0119).
export const listAssignments = async (
  client: PoolClient,
  groupId: string,
): Promise<AssignmentRow[]> => {
  const result = await client.query<AssignmentRow>(
    'SELECT * FROM admin_list_group_assignments($1)',
    [groupId],
  );
  return result.rows;
};

export interface ActiveAssignmentRow {
  id: string;
  group_id: string;
  target_type: AssignmentTargetType;
  target_id: string;
  access_level: ShareAccessLevel;
}

export const findActiveAssignment = async (
  client: PoolClient,
  params: { assignmentId: string; groupId: string },
): Promise<ActiveAssignmentRow | null> => {
  const result = await client.query<ActiveAssignmentRow>(
    `SELECT id, group_id, target_type, target_id, access_level
     FROM machine_group_assignments
     WHERE id = $1 AND group_id = $2 AND revoked_at IS NULL`,
    [params.assignmentId, params.groupId],
  );
  return result.rows[0] ?? null;
};

export const findActiveAssignmentFor = async (
  client: PoolClient,
  params: { groupId: string; targetType: string; targetId: string },
): Promise<ActiveAssignmentRow | null> => {
  const result = await client.query<ActiveAssignmentRow>(
    `SELECT id, group_id, target_type, target_id, access_level
     FROM machine_group_assignments
     WHERE group_id = $1 AND target_type = $2 AND target_id = $3
       AND revoked_at IS NULL`,
    [params.groupId, params.targetType, params.targetId],
  );
  return result.rows[0] ?? null;
};

export const insertAssignment = async (
  client: PoolClient,
  params: {
    groupId: string;
    targetType: AssignmentTargetType;
    targetId: string;
    accessLevel: ShareAccessLevel;
    grantedBy: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO machine_group_assignments
       (group_id, target_type, target_id, access_level, granted_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      params.groupId,
      params.targetType,
      params.targetId,
      params.accessLevel,
      params.grantedBy,
    ],
  );
  return result.rows[0].id;
};

export const updateAssignmentLevel = async (
  client: PoolClient,
  params: { assignmentId: string; accessLevel: ShareAccessLevel },
): Promise<void> => {
  await client.query(
    `UPDATE machine_group_assignments SET access_level = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [params.assignmentId, params.accessLevel],
  );
};

export const revokeAssignment = async (
  client: PoolClient,
  params: { assignmentId: string; revokedBy: string; reason: string },
): Promise<void> => {
  await client.query(
    `UPDATE machine_group_assignments
     SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
     WHERE id = $1 AND revoked_at IS NULL`,
    [params.assignmentId, params.revokedBy, params.reason],
  );
};

// The tenants table has no RLS: any organisation can be a target.
export const findOrganisationName = async (
  client: PoolClient,
  organisationId: string,
): Promise<string | null> => {
  const result = await client.query<{ name: string }>(
    'SELECT name FROM tenants WHERE id = $1 AND deleted_at IS NULL',
    [organisationId],
  );
  return result.rows[0]?.name ?? null;
};

// A person target, through admin_find_user (0119).
export const findUserTarget = async (
  client: PoolClient,
  userId: string,
): Promise<{ id: string; tenant_id: string; name: string } | null> => {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    name: string;
  }>('SELECT id, tenant_id, name FROM admin_find_user($1)', [userId]);
  return result.rows[0] ?? null;
};

// The organisations owning the group's machines, for the owners' audit.
export const listGroupMachineOwners = async (
  client: PoolClient,
  groupId: string,
): Promise<string[]> => {
  const result = await client.query<{ tenant_id: string }>(
    'SELECT DISTINCT tenant_id FROM admin_list_group_machines($1)',
    [groupId],
  );
  return result.rows.map((row) => row.tenant_id);
};
