import { PoolClient } from 'pg';
import {
  MachineScope,
  machineInScopeSql,
  toScopeParam,
} from '../machineGroups/access/machineScope';

export interface MachineDetailsRow {
  site: string | null;
  operating_hours: number | null;
  cover_photo_id: string | null;
}

export interface MachineDetailsChange {
  site?: string | null;
  operatingHours?: number;
  coverPhotoId?: string | null;
}

// Every query filters on tenant_id itself: the backend's database role may
// bypass RLS.

// null when there's no such machine in the caller's machine scope.
export const findMachineDetails = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  scope: MachineScope,
): Promise<MachineDetailsRow | null> => {
  const result = await client.query<MachineDetailsRow>(
    `SELECT m.site, m.operating_hours, m.cover_photo_id FROM machines m
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL
       AND ${machineInScopeSql('m', '$3')}`,
    [machineId, tenantId, toScopeParam(scope)],
  );
  return result.rows[0] ?? null;
};

export const isMachineGalleryPhoto = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; photoId: string },
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM machine_photos
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [params.photoId, params.machineId, params.tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};

// Fields left undefined keep their value ($n::boolean says whether each was
// sent, since null is a real value for site and cover photo).
export const updateMachineDetails = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; change: MachineDetailsChange },
): Promise<void> => {
  const { change } = params;
  await client.query(
    `UPDATE machines SET
       site = CASE WHEN $3::boolean THEN $4 ELSE site END,
       operating_hours = COALESCE($5, operating_hours),
       operating_hours_read_at = CASE WHEN $5::int IS NULL THEN operating_hours_read_at ELSE now() END,
       cover_photo_id = CASE WHEN $6::boolean THEN $7::uuid ELSE cover_photo_id END,
       updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [
      params.machineId,
      params.tenantId,
      change.site !== undefined,
      change.site ?? null,
      change.operatingHours ?? null,
      change.coverPhotoId !== undefined,
      change.coverPhotoId ?? null,
    ],
  );
};
