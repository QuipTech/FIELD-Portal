import { PoolClient } from 'pg';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import { StoredFile } from '../storage/types/storedFile';
import {
  MachineDetailRow,
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

// findMachine plus what the detail header shows: hour-meter read time,
// owner (whoever registered it) and the count of open/in-progress cases.
export const findMachineDetail = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineDetailRow | null> => {
  const result = await client.query<MachineDetailRow>(
    `SELECT m.id, m.serial_number, m.fleet_number, m.status,
            ${MACHINE_LABEL_SQL} AS label, m.site, m.operating_hours, m.operating_hours_read_at,
            mf.name AS manufacturer_name, mm.name AS model_name,
            u.id AS owner_id, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
            u.avatar_url AS owner_avatar_url,
            (SELECT count(*)::int FROM support_cases sc
             WHERE sc.machine_id = m.id AND sc.tenant_id = $2 AND sc.deleted_at IS NULL
               AND sc.status IN ('open', 'in_progress')) AS open_case_count
     FROM machines m
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL`,
    [machineId, tenantId],
  );
  return result.rows[0] ?? null;
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
