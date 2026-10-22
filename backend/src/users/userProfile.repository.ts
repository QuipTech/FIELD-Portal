import { PoolClient } from 'pg';

export interface UserProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  phone_number: string | null;
  site: string | null;
  language: string;
}

const PROFILE_COLUMNS =
  'id, email, first_name, last_name, avatar_url, avatar_storage_key, phone_number, site, language';

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

// A field left undefined keeps its stored value; null clears phone and site.
export const updateUserProfile = async (
  client: PoolClient,
  params: {
    userId: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string | null;
    site?: string | null;
    language?: string;
  },
): Promise<UserProfileRow | null> => {
  const result = await client.query<UserProfileRow>(
    `UPDATE users SET first_name = COALESCE($3, first_name),
       last_name = COALESCE($4, last_name),
       phone_number = CASE WHEN $5 THEN $6 ELSE phone_number END,
       site = CASE WHEN $7 THEN $8 ELSE site END,
       language = COALESCE($9, language)
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING ${PROFILE_COLUMNS}`,
    [
      params.userId,
      params.tenantId,
      params.firstName ?? null,
      params.lastName ?? null,
      params.phoneNumber !== undefined,
      params.phoneNumber ?? null,
      params.site !== undefined,
      params.site ?? null,
      params.language ?? null,
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
