import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthProvider, CognitoIdentity } from '../auth/types/cognitoIdentity';
import { UserRow } from '../auth/types/authRows';
import { AccountIdentityRow, UserCognitoLookupRow } from './types/userRows';

export const findUserByCognitoSub = async (
  databaseService: DatabaseService,
  cognitoSub: string,
): Promise<UserCognitoLookupRow | null> => {
  const result = await databaseService.query<UserCognitoLookupRow>(
    `SELECT * FROM auth_lookup_user_by_cognito_sub($1)`,
    [cognitoSub],
  );
  return result.rows[0] ?? null;
};

export const insertCognitoUser = async (
  client: PoolClient,
  params: { tenantId: string; identity: CognitoIdentity; phoneNumber: string },
): Promise<UserRow> => {
  const { tenantId, identity, phoneNumber } = params;
  const result = await client.query<UserRow>(
    `INSERT INTO users
       (tenant_id, email, cognito_sub, auth_provider, first_name, last_name,
        phone_number, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     RETURNING id, tenant_id, email, first_name, last_name, status, avatar_url,
               avatar_storage_key`,
    [
      tenantId,
      identity.email,
      identity.cognitoSub,
      identity.authProvider,
      identity.firstName,
      identity.lastName,
      phoneNumber,
      identity.pictureUrl,
    ],
  );
  return result.rows[0];
};

// COALESCE: a sign-in without a photo (Apple) keeps the one already saved.
export const linkCognitoIdentity = async (
  client: PoolClient,
  params: {
    userId: string;
    cognitoSub: string;
    authProvider: AuthProvider;
    pictureUrl: string | null;
  },
): Promise<void> => {
  await client.query(
    `UPDATE users
     SET cognito_sub = $2, auth_provider = $3, last_login_at = now(),
         avatar_url = COALESCE($4, avatar_url)
     WHERE id = $1`,
    [params.userId, params.cognitoSub, params.authProvider, params.pictureUrl],
  );
};

// Google photo URLs can change, so every sign-in refreshes the saved one.
export const recordCognitoSignIn = async (
  client: PoolClient,
  params: { userId: string; pictureUrl: string | null },
): Promise<void> => {
  await client.query(
    `UPDATE users
     SET last_login_at = now(), avatar_url = COALESCE($2, avatar_url)
     WHERE id = $1`,
    [params.userId, params.pictureUrl],
  );
};

export const findAccountIdentity = async (
  databaseService: DatabaseService,
  params: { userId: string; tenantId: string },
): Promise<AccountIdentityRow | null> => {
  const result = await databaseService.withTenant(params.tenantId, (client) =>
    client.query<AccountIdentityRow>(
      `SELECT email, cognito_sub, avatar_storage_key FROM users WHERE id = $1`,
      [params.userId],
    ),
  );
  return result.rows[0] ?? null;
};

// True when the user holds Owner and no other live, active user in the
// tenant does — deleting them would leave the organisation unmanaged.
export const isLastOwner = async (
  databaseService: DatabaseService,
  params: { userId: string; tenantId: string; ownerRoleName: string },
): Promise<boolean> => {
  const result = await databaseService.withTenant(params.tenantId, (client) =>
    client.query<{ is_last_owner: boolean }>(
      `SELECT EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
                WHERE ur.user_id = $1 AND r.name = $2)
              AND NOT EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
                JOIN users u ON u.id = ur.user_id
                WHERE ur.tenant_id = $3 AND ur.user_id <> $1 AND r.name = $2
                  AND u.deleted_at IS NULL AND u.status = 'active')
              AS is_last_owner`,
      [params.userId, params.ownerRoleName, params.tenantId],
    ),
  );
  return result.rows[0]?.is_last_owner ?? false;
};

// Hard-deletes the user and all of their personal data in one transaction
// (see 0025_delete_user_account.sql). False means no such user in that tenant.
export const deleteUserAccount = async (
  databaseService: DatabaseService,
  params: { userId: string; tenantId: string },
): Promise<boolean> => {
  const result = await databaseService.query<{ deleted: boolean }>(
    `SELECT delete_user_account($1, $2) AS deleted`,
    [params.userId, params.tenantId],
  );
  return result.rows[0]?.deleted ?? false;
};
