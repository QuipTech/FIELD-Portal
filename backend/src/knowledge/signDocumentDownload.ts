import { ConflictException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { SignedUrl } from '../storage/types/storedFile';
import { KnowledgeDocumentRow } from './types/knowledgeDocumentRows';

const requireStorageKey = (row: KnowledgeDocumentRow): string => {
  if (row.ingestion_status === 'uploading' || !row.storage_key) {
    throw new ConflictException(
      "This document's file hasn't finished uploading.",
    );
  }
  return row.storage_key;
};

// A 15-minute download link that saves under the original file name.
export const signDocumentDownload = (
  storageService: StorageService,
  row: KnowledgeDocumentRow,
): Promise<SignedUrl> =>
  storageService.getSignedDownloadUrl(
    requireStorageKey(row),
    row.file_name ?? row.title,
  );

// The same link without an attachment disposition, so the browser shows
// the file (the admin preview) instead of saving it.
export const signDocumentPreview = (
  storageService: StorageService,
  row: KnowledgeDocumentRow,
): Promise<SignedUrl> =>
  storageService.getSignedDownloadUrl(requireStorageKey(row));
