import { PoolClient } from 'pg';
import { StoredFile } from '../storage/types/storedFile';
import { GalleryPhotoRow } from './types/machineHistoryRows';

const GALLERY_COLUMNS =
  'id, storage_key, file_name, content_type, size_bytes, caption, uploaded_by, created_at';

// Oldest first, the order the gallery shows them in.
export const listGalleryPhotos = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<GalleryPhotoRow[]> => {
  const result = await client.query<GalleryPhotoRow>(
    `SELECT ${GALLERY_COLUMNS},
            COALESCE(id = (SELECT m.cover_photo_id FROM machines m WHERE m.id = machine_id), false) AS is_cover
     FROM machine_photos
     WHERE machine_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY created_at`,
    [machineId, tenantId],
  );
  return result.rows;
};

export const insertGalleryPhoto = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    userId: string;
    caption: string | null;
    stored: StoredFile;
  },
): Promise<GalleryPhotoRow> => {
  const { stored } = params;
  const result = await client.query<GalleryPhotoRow>(
    `INSERT INTO machine_photos
       (tenant_id, machine_id, storage_key, file_name, content_type, size_bytes, caption, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${GALLERY_COLUMNS}, false AS is_cover`,
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

// Soft delete only: the row and the S3 object stay for the audit trail.
export const softDeleteGalleryPhoto = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    photoId: string;
    // Only this person's upload, when set.
    uploadedBy: string | null;
  },
): Promise<{ file_name: string } | null> => {
  const result = await client.query<{ file_name: string }>(
    `UPDATE machine_photos SET deleted_at = now()
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       AND ($4::uuid IS NULL OR uploaded_by = $4)
     RETURNING file_name`,
    [params.photoId, params.machineId, params.tenantId, params.uploadedBy],
  );
  return result.rows[0] ?? null;
};

// A soft delete doesn't fire the foreign key's ON DELETE SET NULL. Only the
// owner can change the machine (RLS), so this does nothing for a 'contribute'
// share; the cover lookup then falls back to the newest live photo anyway.
export const clearCoverPhoto = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; photoId: string },
): Promise<void> => {
  await client.query(
    `UPDATE machines SET cover_photo_id = NULL
     WHERE id = $1 AND tenant_id = $2 AND cover_photo_id = $3`,
    [params.machineId, params.tenantId, params.photoId],
  );
};
