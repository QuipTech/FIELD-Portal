import { PoolClient } from 'pg';
import { StoredFile } from '../storage/types/storedFile';
import { GalleryPhotoRow } from './types/machineHistoryRows';

const GALLERY_COLUMNS = 'id, storage_key, file_name, content_type, size_bytes, caption, created_at';

// Oldest first, the order the gallery shows them in.
export const listGalleryPhotos = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<GalleryPhotoRow[]> => {
  const result = await client.query<GalleryPhotoRow>(
    `SELECT ${GALLERY_COLUMNS}
     FROM machine_photos
     WHERE machine_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY created_at`,
    [machineId, tenantId],
  );
  return result.rows;
};

export const insertGalleryPhoto = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; userId: string; caption: string | null; stored: StoredFile },
): Promise<GalleryPhotoRow> => {
  const { stored } = params;
  const result = await client.query<GalleryPhotoRow>(
    `INSERT INTO machine_photos
       (tenant_id, machine_id, storage_key, file_name, content_type, size_bytes, caption, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${GALLERY_COLUMNS}`,
    [
      params.tenantId,
      params.machineId,
      stored.key,
      stored.fileName,
      stored.contentType,
      stored.sizeBytes,
      params.caption,
      params.userId,
    ],
  );
  return result.rows[0];
};
