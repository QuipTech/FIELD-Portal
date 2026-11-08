import { PoolClient } from 'pg';
import {
  MACHINE_LABEL_SQL,
  MACHINE_PHOTO_KEY_SQL,
} from '../machineFleet/machineFleet.repository';
import { StoredFile } from '../storage/types/storedFile';
import {
  MachineDetailRow,
  MachineRow,
  PhotoRow,
} from './types/machineHistoryRows';
import {
  MachineScope,
  visibleMachineSql,
} from '../machineSharing/access/machineScope';
import { MACHINE_GROUPS_SQL } from '../machineSharing/access/machineGroupsSql';

// Every query filters on tenant_id explicitly as well as relying on RLS.
// tenantId is the machine's OWNING organisation once access is settled
// (assertMachineAccessible); a machine outside the caller's machine scope
// (machineSharing/access) is not found.

export const findMachine = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineRow | null> => {
  const result = await client.query<MachineRow>(
    `SELECT m.id, m.serial_number, m.fleet_number, m.status,
            ${MACHINE_LABEL_SQL} AS label, m.site, m.operating_hours,
            mf.name AS manufacturer_name, mm.name AS model_name,
            m.lifecycle_state
     FROM machines m
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL`,
    [machineId, tenantId],
  );
  return result.rows[0] ?? null;
};

// findMachine plus what the detail header shows: hour-meter read time,
// owner (whoever registered it; users RLS hides a shared machine's), the
// count of open/in-progress cases the caller can see, and how it's shared
// with them. tenantId is the caller's organisation.
export const findMachineDetail = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  scope: MachineScope,
): Promise<MachineDetailRow | null> => {
  const result = await client.query<MachineDetailRow>(
    `SELECT m.id, m.serial_number, m.fleet_number, m.status,
            ${MACHINE_LABEL_SQL} AS label, m.asset_number, m.site, m.operating_hours, m.operating_hours_read_at,
            m.lifecycle_state, ${MACHINE_GROUPS_SQL} AS groups,
            t.name AS owning_organisation_name,
            COALESCE(am.access_level, 'owner') AS access_level,
            COALESCE(am.is_shared, false) AS is_shared,
            mf.name AS manufacturer_name, mm.name AS model_name, mm.id AS model_id,
            u.id AS owner_id, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
            u.avatar_url AS owner_avatar_url,
            ${MACHINE_PHOTO_KEY_SQL} AS photo_storage_key,
            (SELECT count(*)::int FROM support_cases sc
             WHERE sc.machine_id = m.id AND sc.tenant_id = m.tenant_id AND sc.deleted_at IS NULL
               AND sc.status IN ('new', 'open', 'waiting_on_customer')) AS open_case_count
     FROM machines m
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     JOIN tenants t ON t.id = m.tenant_id
     LEFT JOIN accessible_machines() am ON am.machine_id = m.id
     LEFT JOIN users u ON u.id = m.created_by
     WHERE m.id = $1 AND m.deleted_at IS NULL
       AND ${visibleMachineSql('m', '$2', scope)}`,
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
