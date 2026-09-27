import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
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

export const listRoles = async (
  databaseService: DatabaseService,
  roleId: string | null = null,
): Promise<AdminRoleRow[]> => {
  const result = await databaseService.query<AdminRoleRow>(
    `SELECT * FROM admin_list_roles($1)`,
    [roleId],
  );
  return result.rows;
};

export const createRole = async (
  client: PoolClient,
  params: { name: string; permissionCodes: string[] },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `SELECT admin_create_role($1, $2) AS id`,
    [params.name, params.permissionCodes],
  );
  return result.rows[0].id;
};

export const updateRole = async (
  client: PoolClient,
  params: { roleId: string; name?: string; permissionCodes?: string[] },
): Promise<boolean> => {
  const result = await client.query<{ updated: boolean }>(
    `SELECT admin_update_role($1, $2, $3) AS updated`,
    [params.roleId, params.name ?? null, params.permissionCodes ?? null],
  );
  return result.rows[0].updated;
};

export type DeleteRoleOutcome = 'deleted' | 'not_found' | 'in_use';

export const deleteRole = async (
  client: PoolClient,
  roleId: string,
): Promise<DeleteRoleOutcome> => {
  const result = await client.query<{ outcome: DeleteRoleOutcome }>(
    `SELECT admin_delete_role($1) AS outcome`,
    [roleId],
  );
  return result.rows[0].outcome;
};
