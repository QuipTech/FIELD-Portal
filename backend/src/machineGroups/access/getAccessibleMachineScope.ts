import { PoolClient } from 'pg';
import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';
import {
  MachineAccessMode,
  MachineScope,
  ORGANISATION_ADMIN_PERMISSION,
  resolveMachineScope,
} from './machineScope';

interface ScopeRow {
  machine_access_mode: MachineAccessMode;
  is_admin: boolean;
  group_ids: string[];
}

// The one helper every machine read uses (see machineScope.ts). One query:
// the person's stored mode, whether a live role makes them an admin, and
// their groups that still exist. Someone not found sees no machines.
export const getAccessibleMachineScope = async (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
): Promise<MachineScope> => {
  const result = await client.query<ScopeRow>(
    `SELECT u.machine_access_mode,
            EXISTS (
              SELECT 1 FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
              JOIN role_permissions rp ON rp.role_id = r.id
              JOIN permissions p ON p.id = rp.permission_id
              WHERE ur.user_id = u.id AND p.code IN ($3, $4)
            ) AS is_admin,
            ARRAY(
              SELECT a.group_id FROM user_machine_group_access a
              JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
              WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id
              ORDER BY a.group_id
            ) AS group_ids
     FROM users u
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [
      actor.userId,
      actor.tenantId,
      ORGANISATION_ADMIN_PERMISSION,
      PLATFORM_PERMISSION_CODE,
    ],
  );
  const row = result.rows[0];
  if (!row) return { kind: 'groups', groupIds: [] };
  return resolveMachineScope({
    isAdmin: row.is_admin,
    mode: row.machine_access_mode,
    groupIds: row.group_ids,
  });
};
