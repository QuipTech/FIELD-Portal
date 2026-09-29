import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export interface DataExportRow {
  id: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired';
  storage_key: string | null;
  size_bytes: string | null;
  error: string | null;
  requested_at: Date;
  completed_at: Date | null;
  expires_at: Date | null;
}

export interface DeletionRequestRow {
  id: string;
  status: 'pending' | 'completed' | 'cancelled';
  requested_at: Date;
}

const EXPORT_COLUMNS =
  'id, status, storage_key, size_bytes, error, requested_at, completed_at, expires_at';

// ── Exports (request side, tenant role under withTenant) ──────────────
// A second request while one is queued/running hits the partial unique
// index (23505).
export const insertExportRequest = async (
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<DataExportRow> => {
  const result = await client.query<DataExportRow>(
    `INSERT INTO data_export_requests (tenant_id, user_id) VALUES ($1, $2) RETURNING ${EXPORT_COLUMNS}`,
    [tenantId, userId],
  );
  return result.rows[0];
};

export const findLatestExport = async (
  client: PoolClient,
  userId: string,
): Promise<DataExportRow | undefined> => {
  const result = await client.query<DataExportRow>(
    `SELECT ${EXPORT_COLUMNS} FROM data_export_requests WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0];
};

// ── Exports (worker side, cross-tenant SECURITY DEFINER functions) ────
export const claimExportRequest = async (
  databaseService: DatabaseService,
): Promise<{ id: string; tenant_id: string; user_id: string } | undefined> => {
  const result = await databaseService.query<{
    id: string;
    tenant_id: string;
    user_id: string;
  }>('SELECT * FROM claim_data_export_request()');
  return result.rows[0];
};

export const finishExportRequest = async (
  databaseService: DatabaseService,
  params: {
    id: string;
    storageKey: string | null;
    sizeBytes: number | null;
    expiresAt: Date | null;
    error: string | null;
  },
): Promise<void> => {
  await databaseService.query(
    'SELECT finish_data_export_request($1, $2, $3, $4, $5)',
    [
      params.id,
      params.storageKey,
      params.sizeBytes,
      params.expiresAt,
      params.error,
    ],
  );
};

export const expireExportRequests = async (
  databaseService: DatabaseService,
): Promise<{ tenant_id: string; storage_key: string | null }[]> => {
  const result = await databaseService.query<{
    tenant_id: string;
    storage_key: string | null;
  }>('SELECT * FROM expire_data_export_requests()');
  return result.rows;
};

// ── Deletion requests ─────────────────────────────────────────────────
export const findPendingDeletionRequest = async (
  client: PoolClient,
  userId: string,
): Promise<DeletionRequestRow | undefined> => {
  const result = await client.query<DeletionRequestRow>(
    `SELECT id, status, requested_at FROM account_deletion_requests
     WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  );
  return result.rows[0];
};

export const insertDeletionRequest = async (
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<DeletionRequestRow> => {
  const result = await client.query<DeletionRequestRow>(
    `INSERT INTO account_deletion_requests (tenant_id, user_id) VALUES ($1, $2)
     RETURNING id, status, requested_at`,
    [tenantId, userId],
  );
  return result.rows[0];
};
