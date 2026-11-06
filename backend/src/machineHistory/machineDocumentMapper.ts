import { StorageService } from '../storage/storage.service';
import {
  MachineDocument,
  MachineDocumentFile,
} from './types/machineHistoryResponse';
import {
  MachineDocumentListRow,
  MachineDocumentRow,
} from './types/machineHistoryRows';

// Signs fresh 15-minute URLs: one to open the file, one to save it.
export const toMachineDocumentFile = async (
  storageService: StorageService,
  row: MachineDocumentRow,
): Promise<MachineDocumentFile> => {
  const [opened, saved] = await Promise.all([
    storageService.getSignedDownloadUrl(row.storage_key),
    storageService.getSignedDownloadUrl(row.storage_key, row.file_name),
  ]);
  return {
    id: row.id,
    historyEntryId: row.history_entry_id,
    documentType: row.document_type,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    uploadedAt: new Date(row.created_at).toISOString(),
    signedUrl: opened.url,
    downloadUrl: saved.url,
  };
};

const toUploaderName = (row: MachineDocumentListRow): string | null =>
  [row.uploader_first_name, row.uploader_last_name].filter(Boolean).join(' ') ||
  row.uploader_organisation_name ||
  null;

export const toMachineDocument = async (
  storageService: StorageService,
  row: MachineDocumentListRow,
  canDelete: boolean,
): Promise<MachineDocument> => ({
  ...(await toMachineDocumentFile(storageService, row)),
  uploadedByName: toUploaderName(row),
  canDelete,
});
