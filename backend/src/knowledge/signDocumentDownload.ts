import { ConflictException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { SignedUrl } from '../storage/types/storedFile';
import { KnowledgeDocumentRow } from './types/knowledgeDocumentRows';

// A 15-minute download link that saves under the original file name.
export const signDocumentDownload = (
  storageService: StorageService,
  row: KnowledgeDocumentRow,
): Promise<SignedUrl> => {
  if (row.ingestion_status === 'uploading' || !row.storage_key) {
    throw new ConflictException(
      "This document's file hasn't finished uploading.",
    );
  }
  return storageService.getSignedDownloadUrl(
    row.storage_key,
    row.file_name ?? row.title,
  );
};
