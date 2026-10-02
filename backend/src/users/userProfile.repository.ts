import { PoolClient } from 'pg';

export interface UserProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  phone_number: string | null;
}

const PROFILE_COLUMNS =
  'id, email, first_name, last_name, avatar_url, avatar_storage_key, phone_number';

// All queries are keyed on user id AND tenant id: a user can only ever
// touch their own row inside their own organisation.

export const findUserProfile = async (
  client: PoolClient,
  params: { userId: string; tenantId: string },
): Promise<UserProfileRow | null> => {
  const result = await client.query<UserProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM users
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [params.userId, params.tenantId],
  );
  return result.rows[0] ?? null;
};

// phoneNumber undefined leaves the stored number as it is.
export const updateUserProfile = async (
  client: PoolClient,
  params: {
    userId: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
  },
): Promise<UserProfileRow | null> => {
  const result = await client.query<UserProfileRow>(
    `UPDATE users SET first_name = $3, last_name = $4,
       phone_number = CASE WHEN $5 THEN $6 ELSE phone_number END
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING ${PROFILE_COLUMNS}`,
    [
      params.userId,
      params.tenantId,
      params.firstName,
      params.lastName,
      params.phoneNumber !== undefined,
      params.phoneNumber ?? null,
    ],
  );
  return result.rows[0] ?? null;
};

export const setAvatarStorageKey = async (
  client: PoolClient,
  params: { userId: string; tenantId: string; key: string },
): Promise<UserProfileRow | null> => {
  const result = await client.query<UserProfileRow>(
    `UPDATE users SET avatar_storage_key = $3
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING ${PROFILE_COLUMNS}`,
    [params.userId, params.tenantId, params.key],
  );
  return result.rows[0] ?? null;
};
