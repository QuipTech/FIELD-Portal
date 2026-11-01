import { PoolClient } from 'pg';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import {
  MachineAccessMode,
  ORGANISATION_ADMIN_PERMISSION,
} from './access/machineScope';
import { GroupRefRow } from './types/machineGroupTypes';

// People's machine access (users.machine_access_mode and their groups).
// Every query filters on tenant_id itself as well as relying on RLS.

export interface UserMachineAccessRow {
  user_id: string;
  machine_access_mode: MachineAccessMode;
  // A live role makes them an organisation or platform admin, who always
  // sees every machine.
  is_admin: boolean;
  // Live groups only, sorted by name, as JSON from json_agg.
  groups: GroupRefRow[];
}

export const findUsersMachineAccess = async (
  client: PoolClient,
  tenantId: string,
  userIds: string[],
): Promise<UserMachineAccessRow[]> => {
  const result = await client.query<UserMachineAccessRow>(
    `SELECT u.id AS user_id, u.machine_access_mode,
            EXISTS (
              SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
              JOIN role_permissions rp ON rp.role_id = r.id
              JOIN permissions p ON p.id = rp.permission_id
              WHERE ur.user_id = u.id AND p.code IN ($3, $4)
            ) AS is_admin,
            COALESCE((
              SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'colour', g.colour)
                              ORDER BY lower(g.name), g.id)
              FROM user_machine_group_access a
              JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
              WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id
            ), '[]'::json) AS groups
     FROM users u
     WHERE u.tenant_id = $1 AND u.id = ANY($2::uuid[]) AND u.deleted_at IS NULL`,
    [
      tenantId,
      userIds,
      ORGANISATION_ADMIN_PERMISSION,
      PLATFORM_PERMISSION_CODE,
    ],
  );
  return result.rows;
};

// Sets the mode and replaces the person's groups with `groupIds`.
export const replaceUserMachineAccess = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    mode: MachineAccessMode;
    groupIds: string[];
  },
): Promise<void> => {
  await client.query(
    `UPDATE users SET machine_access_mode = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [params.userId, params.tenantId, params.mode],
  );
  await client.query(
    `DELETE FROM user_machine_group_access
     WHERE user_id = $1 AND tenant_id = $2 AND NOT (group_id = ANY($3::uuid[]))`,
    [params.userId, params.tenantId, params.groupIds],
  );
  await client.query(
    `INSERT INTO user_machine_group_access (tenant_id, user_id, group_id)
     SELECT $1, $2, unnest($3::uuid[])
     ON CONFLICT (user_id, group_id) DO NOTHING`,
    [params.tenantId, params.userId, params.groupIds],
  );
};
