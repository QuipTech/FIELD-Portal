import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AdminRoleRow, PermissionRow } from './types/adminRoleRows';

// permissions is shared reference data with no RLS.
export const listPermissions = async (
  databaseService: DatabaseService,
): Promise<PermissionRow[]> => {
  const result = await databaseService.query<PermissionRow>(
    `SELECT code, COALESCE(description, code) AS description
     FROM permissions ORDER BY code`,
  );
  return result.rows;
};

// scope.tenantId is each role function's p_tenant_id (migration 0057):
// system roles plus that organisation's, or every role for the Owner.
// Writes are limited to the same scope inside the functions.
export const listRoles = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  roleId: string | null = null,
): Promise<AdminRoleRow[]> => {
  const result = await databaseService.query<AdminRoleRow>(
    `SELECT * FROM admin_list_roles($1, $2)`,
    [scope.tenantId, roleId],
  );
  return result.rows;
};

// An organisation admin's role belongs to their organisation; the Owner's
// is a
// system role.
export const createRole = async (
  client: PoolClient,
  scope: AdminScope,
  params: { name: string; permissionCodes: string[] },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `SELECT admin_create_role($1, $2, $3) AS id`,
    [scope.tenantId, params.name, params.permissionCodes],
  );
  return result.rows[0].id;
};

export const updateRole = async (
  client: PoolClient,
  scope: AdminScope,
  params: { roleId: string; name?: string; permissionCodes?: string[] },
): Promise<boolean> => {
  const result = await client.query<{ updated: boolean }>(
    `SELECT admin_update_role($1, $2, $3, $4) AS updated`,
    [
      scope.tenantId,
      params.roleId,
      params.name ?? null,
      params.permissionCodes ?? null,
    ],
  );
  return result.rows[0].updated;
};

// 'default_role': shipped with the platform, never deleted (0062).
export type DeleteRoleOutcome =
  'deleted' | 'not_found' | 'in_use' | 'default_role';

export const deleteRole = async (
  client: PoolClient,
  scope: AdminScope,
  roleId: string,
): Promise<DeleteRoleOutcome> => {
  const result = await client.query<{ outcome: DeleteRoleOutcome }>(
    `SELECT admin_delete_role($1, $2) AS outcome`,
    [scope.tenantId, roleId],
  );
  return result.rows[0].outcome;
};
