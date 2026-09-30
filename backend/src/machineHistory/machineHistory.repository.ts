import { PoolClient } from 'pg';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import { StoredFile } from '../storage/types/storedFile';
import {
  HistoryEntryRow,
  MachineRow,
  PhotoRow,
} from './types/machineHistoryRows';

// Every query filters on tenant_id explicitly as well as relying on RLS,
// since the backend's database role may bypass RLS.

export const findMachine = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineRow | null> => {
  const result = await client.query<MachineRow>(
    `SELECT m.id, m.serial_number, m.fleet_number, m.status,
            ${MACHINE_LABEL_SQL} AS label, m.site, m.operating_hours,
            mf.name AS manufacturer_name, mm.name AS model_name
     FROM machines m
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL`,
    [machineId, tenantId],
  );
  return result.rows[0] ?? null;
};

export const listHistoryEntries = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<HistoryEntryRow[]> => {
  const result = await client.query<HistoryEntryRow>(
    `SELECT e.id, e.entry_type, e.description, e.is_amendment, e.created_at,
            u.id AS author_id, u.first_name AS author_first_name, u.last_name AS author_last_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', a.id, 'storage_key', a.storage_key, 'file_name', a.file_name,
                       'content_type', a.content_type, 'size_bytes', a.size_bytes,
                       'created_at', a.created_at) ORDER BY a.created_at)
              FROM technical_attachments a
              WHERE a.history_entry_id = e.id AND a.tenant_id = $2
                AND a.file_type = 'photo' AND a.deleted_at IS NULL
                AND a.storage_key IS NOT NULL
            ), '[]'::json) AS photos
     FROM technical_history_entries e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.machine_id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL
     ORDER BY e.created_at DESC`,
    [machineId, tenantId],
  );
  return result.rows;
};

export const insertHistoryEntry = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    userId: string;
    entryType: string;
    description: string;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO technical_history_entries (tenant_id, machine_id, entry_type, description, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      params.tenantId,
      params.machineId,
      params.entryType,
      params.description,
      params.userId,
    ],
  );
  return result.rows[0].id;
};

export const historyEntryExists = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; entryId: string },
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM technical_history_entries
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [params.entryId, params.machineId, params.tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const insertPhotoAttachment = async (
  client: PoolClient,
  params: {
    tenantId: string;
    entryId: string;
    userId: string;
    bucket: string;
    stored: StoredFile;
  },
): Promise<PhotoRow> => {
  const { stored } = params;
  const result = await client.query<PhotoRow>(
    `INSERT INTO technical_attachments
       (tenant_id, history_entry_id, file_url, file_type, storage_key, file_name,
        content_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, 'photo', $4, $5, $6, $7, $8)
     RETURNING id, storage_key, file_name, content_type, size_bytes, created_at`,
    [
      params.tenantId,
      params.entryId,
      `s3://${params.bucket}/${stored.key}`,
      stored.key,
      stored.fileName,
      stored.contentType,
      stored.sizeBytes,
      params.userId,
    ],
  );
  return result.rows[0];
};

// Soft delete only: the row and the S3 object stay for the audit trail.
export const softDeletePhoto = async (
  client: PoolClient,
  params: { tenantId: string; entryId: string; photoId: string },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE technical_attachments SET deleted_at = now()
     WHERE id = $1 AND history_entry_id = $2 AND tenant_id = $3
       AND file_type = 'photo' AND deleted_at IS NULL`,
    [params.photoId, params.entryId, params.tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};
