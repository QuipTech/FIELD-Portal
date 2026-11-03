import { PoolClient } from 'pg';
import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';
import { ORGANISATION_ADMIN_PERMISSION } from './machineScope';

// The other direction of accessible_machines(): of these people in the
// machine's OWN organisation, who may see it? Admins and 'all' see every
// machine of their organisation; 'groups_only' only those in a group
// assigned to them or their organisation (and not withdrawn). People it's
// shared with in other organisations get no messages about it. A machine
// that doesn't exist in the organisation is seen by no one.
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
           SELECT 1 FROM machine_group_assignments a
           JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
           JOIN machine_group_machines gm ON gm.group_id = g.id AND gm.machine_id = m.id
           WHERE a.revoked_at IS NULL
             AND ((a.target_type = 'user' AND a.target_id = u.id)
               OR (a.target_type = 'organisation' AND a.target_id = u.tenant_id))
             AND NOT EXISTS (
               SELECT 1 FROM machine_share_exclusions x
               WHERE x.assignment_id = a.id AND x.machine_id = m.id)))`,
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
