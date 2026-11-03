import { PoolClient } from 'pg';
import { MachineGroupRow } from '../types/machineGroupTypes';

// Platform-level machine groups. Only the platform administrator writes
// them (RLS: is_platform_admin()); deleted groups are never returned.

const GROUP_COLUMNS = `
  g.id, g.name, g.colour, g.description, g.created_at, g.updated_at,
  (SELECT count(*)::int FROM machine_group_machines gm
   JOIN machines m ON m.id = gm.machine_id AND m.deleted_at IS NULL
   WHERE gm.group_id = g.id) AS machine_count,
  (SELECT count(*)::int FROM machine_group_assignments a
   WHERE a.group_id = g.id AND a.revoked_at IS NULL
     AND a.target_type = 'organisation') AS organisation_count,
  (SELECT count(*)::int FROM machine_group_assignments a
   WHERE a.group_id = g.id AND a.revoked_at IS NULL
     AND a.target_type = 'user') AS user_count`;

export interface MachineGroupFields {
  name?: string;
  colour?: string | null;
  description?: string | null;
}

const FIELD_COLUMNS: Record<keyof MachineGroupFields, string> = {
  name: 'name',
  colour: 'colour',
  description: 'description',
};

export const listGroups = async (
  client: PoolClient,
): Promise<MachineGroupRow[]> => {
  const result = await client.query<MachineGroupRow>(
    `SELECT ${GROUP_COLUMNS} FROM machine_groups g
     WHERE g.deleted_at IS NULL
     ORDER BY lower(g.name), g.id`,
  );
  return result.rows;
};

export const findGroup = async (
  client: PoolClient,
  groupId: string,
): Promise<MachineGroupRow | null> => {
  const result = await client.query<MachineGroupRow>(
    `SELECT ${GROUP_COLUMNS} FROM machine_groups g
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [groupId],
  );
  return result.rows[0] ?? null;
};

// A live name already used (ignoring case) is a unique violation.
export const insertGroup = async (
  client: PoolClient,
  params: { fields: MachineGroupFields & { name: string }; createdBy: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO machine_groups (name, colour, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      params.fields.name,
      params.fields.colour ?? null,
      params.fields.description ?? null,
      params.createdBy,
    ],
  );
  return result.rows[0].id;
};

// Only the fields sent change.
export const updateGroup = async (
  client: PoolClient,
  params: { groupId: string; fields: MachineGroupFields },
): Promise<void> => {
  const values: unknown[] = [params.groupId];
  const assignments = (
    Object.keys(FIELD_COLUMNS) as (keyof MachineGroupFields)[]
  )
    .filter((key) => params.fields[key] !== undefined)
    .map((key) => {
      values.push(params.fields[key]);
      return `${FIELD_COLUMNS[key]} = $${values.length}`;
    });
  await client.query(
    `UPDATE machine_groups SET ${[...assignments, 'updated_at = now()'].join(', ')}
     WHERE id = $1 AND deleted_at IS NULL`,
    values,
  );
};

// Its assignments end with it (revoked, reason "Group deleted"); its
// machine list stays, unused, for the record.
export const softDeleteGroup = async (
  client: PoolClient,
  params: { groupId: string; deletedBy: string; reason: string },
): Promise<void> => {
  await client.query(
    `UPDATE machine_group_assignments
     SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
     WHERE group_id = $1 AND revoked_at IS NULL`,
    [params.groupId, params.deletedBy, params.reason],
  );
  await client.query(
    `UPDATE machine_groups SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [params.groupId],
  );
};

export interface GroupActivityRow {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  actor_first_name: string | null;
  actor_last_name: string | null;
}

// The group's audit entries in the platform administrator's organisation
// (where every change to it is logged), newest first.
export const listGroupActivity = async (
  client: PoolClient,
  params: { tenantId: string; groupId: string; limit: number },
): Promise<GroupActivityRow[]> => {
  const result = await client.query<GroupActivityRow>(
    `SELECT l.id, l.action, l.metadata, l.created_at,
            u.first_name AS actor_first_name, u.last_name AS actor_last_name
     FROM audit_logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.tenant_id = $1 AND l.entity_type = 'machine_group'
       AND l.entity_id = $2
     ORDER BY l.created_at DESC, l.id
     LIMIT $3`,
    [params.tenantId, params.groupId, params.limit],
  );
  return result.rows;
};
