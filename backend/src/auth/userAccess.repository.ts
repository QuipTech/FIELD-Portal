import { PoolClient } from 'pg';

// What a user may do: their role names and the permission codes those
// roles grant. Both are read inside the caller's tenant context (RLS).

export const findSystemRoleIdByName = async (
  client: PoolClient,
  name: string,
): Promise<string | null> => {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM roles
     WHERE name = $1 AND is_system_role = true AND tenant_id IS NULL
       AND deleted_at IS NULL
     LIMIT 1`,
    [name],
  );
  return result.rows[0]?.id ?? null;
};

export const insertUserRole = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; roleId: string },
): Promise<void> => {
  await client.query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`,
    [params.tenantId, params.userId, params.roleId],
  );
};

// System roles (tenant_id IS NULL) plus any tenant-defined ones.
export const findUserRoleNames = async (
  client: PoolClient,
  userId: string,
): Promise<string[]> => {
  const result = await client.query<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.name`,
    [userId],
  );
  return result.rows.map((row) => row.name);
};

// Union of every permission the user's live roles grant.
export const findUserPermissionCodes = async (
  client: PoolClient,
  userId: string,
): Promise<string[]> => {
  const result = await client.query<{ code: string }>(
    `SELECT DISTINCT p.code FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
     ORDER BY p.code`,
    [userId],
  );
  return result.rows.map((row) => row.code);
};

export interface UserAccess {
  roles: string[];
  permissions: string[];
}

export const findUserAccess = async (
  client: PoolClient,
  userId: string,
): Promise<UserAccess> => ({
  roles: await findUserRoleNames(client, userId),
  permissions: await findUserPermissionCodes(client, userId),
});
