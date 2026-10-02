import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { AdminUserRow } from './types/adminUserRows';

// scope.tenantId is admin_list_users' p_tenant_id (migration 0056): the
// scoped organisation, or null (every organisation) for the Owner.
export const listAdminUsers = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  params: { search?: string; role?: string; limit: number; offset: number },
): Promise<AdminUserRow[]> => {
  const result = await databaseService.query<AdminUserRow>(
    `SELECT * FROM admin_list_users($1, $2, $3, $4, $5)`,
    [
      scope.tenantId,
      params.search ? escapeLikePattern(params.search) : null,
      params.role ?? null,
      params.limit,
      params.offset,
    ],
  );
  return result.rows;
};

// admin_invite_user (migration 0059): the user as 'invited' plus their
// role, refusing roles the organisation can't use.
export const insertInvitedUser = async (
  client: PoolClient,
  params: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    cognitoSub: string;
    roleId: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `SELECT admin_invite_user($1, $2, $3, $4, $5, $6) AS id`,
    [
      params.tenantId,
      params.email,
      params.firstName,
      params.lastName,
      params.cognitoSub,
      params.roleId,
    ],
  );
  return result.rows[0].id;
};

// The Organisation filter and the invite form's organisation picker:
// every organisation for the Owner, the scoped one otherwise.
// tenants has no RLS.
export const listOrganisations = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<{ id: string; name: string }[]> => {
  const result = await databaseService.query<{ id: string; name: string }>(
    `SELECT id, name FROM tenants
     WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR id = $1)
     ORDER BY lower(name)`,
    [scope.tenantId],
  );
  return result.rows;
};

export type SetUserRoleOutcome =
  'updated' | 'not_found' | 'role_not_allowed' | 'last_owner';

// Gives the user exactly this role (admin_set_user_role, migration 0061);
// refuses roles outside their organisation and removing the last Owner.
export const setUserRole = async (
  client: PoolClient,
  params: { userId: string; roleId: string },
): Promise<SetUserRoleOutcome> => {
  const result = await client.query<{ outcome: SetUserRoleOutcome }>(
    `SELECT admin_set_user_role($1, $2) AS outcome`,
    [params.userId, params.roleId],
  );
  return result.rows[0].outcome;
};
