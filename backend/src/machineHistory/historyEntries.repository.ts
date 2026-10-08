import { PoolClient } from 'pg';
import { HistoryEntryRow } from './types/machineHistoryRows';

// Every query filters on tenant_id explicitly as well as relying on RLS,
// since the backend's database role may bypass RLS.

export interface HistoryEntryFilters {
  entryType?: string;
  // ISO timestamps, inclusive.
  from?: string;
  to?: string;
  authorId?: string;
  entryId?: string;
  limit?: number;
  offset?: number;
}

// Newest first. Without a limit, the machine's whole history.
export const listHistoryEntries = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  filters: HistoryEntryFilters = {},
): Promise<HistoryEntryRow[]> => {
  const result = await client.query<HistoryEntryRow>(
    `SELECT e.id, e.entry_type, e.description, e.is_amendment, e.created_at,
            e.operating_hours, e.downtime_hours,
            u.id AS author_id, u.first_name AS author_first_name, u.last_name AS author_last_name,
            c.id AS component_id, c.name AS component_name, s.name AS system_name,
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
     LEFT JOIN installed_components c ON c.id = e.installed_component_id
     LEFT JOIN installed_systems s ON s.id = c.installed_system_id
     WHERE e.machine_id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL
       AND ($3::varchar IS NULL OR e.entry_type = $3)
       AND ($4::timestamptz IS NULL OR e.created_at >= $4)
       AND ($5::timestamptz IS NULL OR e.created_at <= $5)
       AND ($6::uuid IS NULL OR e.created_by = $6)
       AND ($7::uuid IS NULL OR e.id = $7)
     ORDER BY e.created_at DESC
     LIMIT $8 OFFSET $9`,
    [
      machineId,
      tenantId,
      filters.entryType ?? null,
      filters.from ?? null,
      filters.to ?? null,
      filters.authorId ?? null,
      filters.entryId ?? null,
      filters.limit ?? null,
      filters.offset ?? 0,
    ],
  );
  return result.rows;
};

// Everyone who has written an entry on the machine, for the author filter.
export const listHistoryAuthors = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<{ id: string; first_name: string | null; last_name: string | null }[]> => {
  const result = await client.query(
    `SELECT DISTINCT u.id, u.first_name, u.last_name
     FROM technical_history_entries e
     JOIN users u ON u.id = e.created_by
     WHERE e.machine_id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL
     ORDER BY u.first_name, u.last_name`,
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
    componentId: string | null;
    operatingHours: number | null;
    downtimeHours: number | null;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO technical_history_entries
       (tenant_id, machine_id, entry_type, description, created_by,
        installed_component_id, operating_hours, downtime_hours)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      params.tenantId,
      params.machineId,
      params.entryType,
      params.description,
      params.userId,
      params.componentId,
      params.operatingHours,
      params.downtimeHours,
    ],
  );
  return result.rows[0].id;
};

// A newer hour-meter reading from an entry becomes the machine's own.
export const recordOperatingHours = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; operatingHours: number },
): Promise<void> => {
  await client.query(
    `UPDATE machines SET operating_hours = $3, operating_hours_read_at = now()
     WHERE id = $1 AND tenant_id = $2
       AND (operating_hours IS NULL OR operating_hours <= $3)`,
    [params.machineId, params.tenantId, params.operatingHours],
  );
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
