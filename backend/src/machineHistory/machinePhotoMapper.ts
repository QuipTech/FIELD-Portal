import { StorageService } from '../storage/storage.service';
import { PhotoRow } from './types/machineHistoryRows';
import { MachinePhoto } from './types/machineHistoryResponse';

// Signs a fresh 15-minute URL for each photo; images render inline.
export const toMachinePhoto = async (
  storageService: StorageService,
  row: PhotoRow,
): Promise<MachinePhoto> => ({
  id: row.id,
  fileName: row.file_name,
  contentType: row.content_type,
  sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
  uploadedAt: new Date(row.created_at).toISOString(),
  signedUrl: (await storageService.getSignedDownloadUrl(row.storage_key)).url,
});
