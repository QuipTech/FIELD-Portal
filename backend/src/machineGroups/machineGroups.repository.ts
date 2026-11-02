import { PoolClient } from 'pg';
import {
  GroupRefRow,
  GroupUserRow,
  MachineGroupRow,
} from './types/machineGroupTypes';

// Every query filters on tenant_id itself as well as relying on RLS, since
// the backend's database role may bypass RLS. Deleted groups are never
// returned.

const GROUP_COLUMNS = `
  g.id, g.name, g.colour, g.contact_name, g.contact_email, g.contact_phone,
  g.notes, g.created_at, g.updated_at,
  (SELECT count(*)::int FROM machines m
   WHERE m.group_id = g.id AND m.tenant_id = g.tenant_id AND m.deleted_at IS NULL
  ) AS machine_count,
  (SELECT count(*)::int FROM user_machine_group_access a
   JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
     AND u.machine_access_mode = 'selected'
   WHERE a.group_id = g.id AND a.tenant_id = g.tenant_id
  ) AS user_count`;

export interface MachineGroupFields {
  name?: string;
  colour?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

const FIELD_COLUMNS: Record<keyof MachineGroupFields, string> = {
  name: 'name',
  colour: 'colour',
  contactName: 'contact_name',
  contactEmail: 'contact_email',
  contactPhone: 'contact_phone',
  notes: 'notes',
};

export const listGroups = async (
  client: PoolClient,
  tenantId: string,
): Promise<MachineGroupRow[]> => {
  const result = await client.query<MachineGroupRow>(
    `SELECT ${GROUP_COLUMNS} FROM machine_groups g
     WHERE g.tenant_id = $1 AND g.deleted_at IS NULL
     ORDER BY lower(g.name), g.id`,
    [tenantId],
  );
  return result.rows;
};

export const findGroup = async (
  client: PoolClient,
  tenantId: string,
  groupId: string,
): Promise<MachineGroupRow | null> => {
  const result = await client.query<MachineGroupRow>(
    `SELECT ${GROUP_COLUMNS} FROM machine_groups g
     WHERE g.id = $1 AND g.tenant_id = $2 AND g.deleted_at IS NULL`,
    [groupId, tenantId],
  );
  return result.rows[0] ?? null;
};

// The live groups among `groupIds` (others are another organisation's,
// deleted or made up).
export const findLiveGroups = async (
  client: PoolClient,
  tenantId: string,
  groupIds: string[],
): Promise<GroupRefRow[]> => {
  const result = await client.query<GroupRefRow>(
    `SELECT id, name, colour FROM machine_groups
     WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
     ORDER BY lower(name), id`,
    [tenantId, groupIds],
  );
  return result.rows;
};

// The live group with this name, ignoring case (the fleet CSV import).
export const findGroupByName = async (
  client: PoolClient,
  tenantId: string,
  name: string,
): Promise<GroupRefRow | null> => {
  const result = await client.query<GroupRefRow>(
    `SELECT id, name, colour FROM machine_groups
     WHERE tenant_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL`,
    [tenantId, name],
  );
  return result.rows[0] ?? null;
};

// People limited to selected groups who have this one.
export const listGroupUsers = async (
  client: PoolClient,
  tenantId: string,
  groupId: string,
): Promise<GroupUserRow[]> => {
  const result = await client.query<GroupUserRow>(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.status
     FROM user_machine_group_access a
     JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
     WHERE a.group_id = $1 AND a.tenant_id = $2
       AND u.deleted_at IS NULL AND u.machine_access_mode = 'selected'
     ORDER BY lower(u.first_name), lower(u.last_name), u.id`,
    [groupId, tenantId],
  );
  return result.rows;
};

// A live name already used in the organisation is a unique violation.
export const insertGroup = async (
  client: PoolClient,
  tenantId: string,
  fields: MachineGroupFields & { name: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO machine_groups
       (tenant_id, name, colour, contact_name, contact_email, contact_phone, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      tenantId,
      fields.name,
      fields.colour ?? null,
      fields.contactName ?? null,
      fields.contactEmail ?? null,
      fields.contactPhone ?? null,
      fields.notes ?? null,
    ],
  );
  return result.rows[0].id;
};

// Only the fields sent change.
export const updateGroup = async (
  client: PoolClient,
  params: { tenantId: string; groupId: string; fields: MachineGroupFields },
): Promise<void> => {
  const values: unknown[] = [params.groupId, params.tenantId];
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
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    values,
  );
};

export const softDeleteGroup = async (
  client: PoolClient,
  tenantId: string,
  groupId: string,
): Promise<void> => {
  await client.query(
    `UPDATE machine_groups SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [groupId, tenantId],
  );
};
