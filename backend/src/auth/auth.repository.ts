import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { SessionRow, TenantRow, UserLoginRow, UserRow } from './types/authRows';
import { getRequestSource } from '../common/requestSource/requestSource';

export const insertTenant = async (
  client: PoolClient,
  name: string,
  slug: string,
): Promise<TenantRow> => {
  const result = await client.query<TenantRow>(
    `INSERT INTO tenants (name, slug) VALUES ($1, $2)
     RETURNING id, name, slug`,
    [name, slug],
  );
  return result.rows[0];
};

export const insertUser = async (
  client: PoolClient,
  params: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  },
): Promise<UserRow> => {
  const result = await client.query<UserRow>(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, email, first_name, last_name, status, avatar_url,
               avatar_storage_key`,
    [
      params.tenantId,
      params.email,
      params.passwordHash,
      params.firstName,
      params.lastName,
    ],
  );
  return result.rows[0];
};

export const insertAuditLog = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    action: 'create' | 'update' | 'delete' | 'login';
    entityId: string;
    entityType?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  // source is the client app behind the current request (see
  // common/requestSource), NULL outside a request.
  await client.query(
    `INSERT INTO audit_logs
       (tenant_id, user_id, action, entity_type, entity_id, metadata, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.tenantId,
      params.userId,
      params.action,
      params.entityType ?? 'user',
      params.entityId,
      params.metadata ?? {},
      getRequestSource() ?? null,
    ],
  );
};

export const updateUserLastLogin = async (
  client: PoolClient,
  userId: string,
): Promise<void> => {
  await client.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [
    userId,
  ]);
};

export const findTenantById = async (
  client: PoolClient,
  tenantId: string,
): Promise<TenantRow> => {
  const result = await client.query<TenantRow>(
    `SELECT id, name, slug FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0];
};

export const findUserById = async (
  client: PoolClient,
  userId: string,
): Promise<UserRow | null> => {
  const result = await client.query<UserRow>(
    `SELECT id, tenant_id, email, first_name, last_name, status, avatar_url,
            avatar_storage_key
     FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
};

export const findUserByEmailForLogin = async (
  databaseService: DatabaseService,
  email: string,
): Promise<UserLoginRow | null> => {
  const result = await databaseService.query<UserLoginRow>(
    `SELECT * FROM auth_lookup_user_by_email($1)`,
    [email],
  );
  return result.rows[0] ?? null;
};

export const insertSession = async (
  client: PoolClient,
  params: {
    id: string;
    tenantId: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO sessions (id, tenant_id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.id,
      params.tenantId,
      params.userId,
      params.refreshTokenHash,
      params.expiresAt,
    ],
  );
};

export const rotateSession = async (
  client: PoolClient,
  params: { sessionId: string; refreshTokenHash: string; expiresAt: Date },
): Promise<void> => {
  await client.query(
    `UPDATE sessions SET refresh_token_hash = $2, expires_at = $3 WHERE id = $1`,
    [params.sessionId, params.refreshTokenHash, params.expiresAt],
  );
};

export const findSessionById = async (
  client: PoolClient,
  sessionId: string,
): Promise<SessionRow | null> => {
  const result = await client.query<SessionRow>(
    `SELECT id, tenant_id, user_id, refresh_token_hash, expires_at
     FROM sessions WHERE id = $1`,
    [sessionId],
  );
  return result.rows[0] ?? null;
};

export const expireSession = async (
  client: PoolClient,
  sessionId: string,
): Promise<void> => {
  await client.query(`UPDATE sessions SET expires_at = now() WHERE id = $1`, [
    sessionId,
  ]);
};
