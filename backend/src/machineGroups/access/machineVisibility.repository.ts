import { PoolClient } from 'pg';
import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';
import { ORGANISATION_ADMIN_PERMISSION } from './machineScope';

// The other direction of getAccessibleMachineScope: of these people, who
// may see this machine? Same rule (admins and 'all' see every machine,
// 'selected' only their live groups'), for messages about a machine such
// as alerts. A machine that doesn't exist in the organisation is seen by
// no one.
export const filterUsersWhoCanSeeMachine = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; userIds: string[] },
): Promise<Set<string>> => {
  const result = await client.query<{ id: string }>(
    `SELECT u.id
     FROM users u
     JOIN machines m ON m.id = $2 AND m.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.id = ANY($3::uuid[])
       AND (
         u.machine_access_mode = 'all'
         OR EXISTS (
           SELECT 1 FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = u.id AND p.code IN ($4, $5))
         OR EXISTS (
           SELECT 1 FROM user_machine_group_access a
           JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
           WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id
             AND a.group_id = m.group_id))`,
    [
      params.tenantId,
      params.machineId,
      params.userIds,
      ORGANISATION_ADMIN_PERMISSION,
      PLATFORM_PERMISSION_CODE,
    ],
  );
  return new Set(result.rows.map((row) => row.id));
};

// The machine a support case is about, or null (a case alert's machine).
export const findCaseMachineId = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string },
): Promise<string | null> => {
  const result = await client.query<{ machine_id: string | null }>(
    `SELECT machine_id FROM support_cases WHERE id = $1 AND tenant_id = $2`,
    [params.caseId, params.tenantId],
  );
  return result.rows[0]?.machine_id ?? null;
};
