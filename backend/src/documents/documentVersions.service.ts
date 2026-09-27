import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import { IncomingFile, StoredFile } from '../storage/types/storedFile';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import { KnowledgeDocument } from '../knowledge/types/knowledgeDocumentResponse';
import * as lifecycleRepository from './documentLifecycle.repository';
import { assertCanManageDocument, loadActorAccess } from './documentAccess';
import { auditDocumentChange } from './documentAudit';
import { DocumentLifecycleService } from './documentLifecycle.service';

const BUSY_STATES = ['uploading', 'queued', 'indexing'];

// A new file for an existing document (≤ 20 MB, through the backend). The
// previous versions and their files stay; the live one keeps serving AI
// search until the new one goes live. (Large shared-library files use the
// admin direct-upload route instead.)
@Injectable()
export class DocumentVersionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
    private readonly indexingWorker: IndexingWorkerService,
    private readonly lifecycle: DocumentLifecycleService,
  ) {}

  uploadVersion = async (
    actor: AuthenticatedUser,
    itemId: string,
    file: IncomingFile | undefined,
  ): Promise<KnowledgeDocument> => {
    const row = await this.lifecycle.findVisibleRow(actor, itemId);
    assertCanManageDocument(
      row,
      await loadActorAccess(this.databaseService, actor),
    );
    assertAcceptsNewVersion(row);

    const versionId = randomUUID();
    const stored = await this.storeFile(row, versionId, file);
    const versionNumber = await lifecycleRepository
      .createDocumentVersion(this.databaseService, {
        itemId,
        versionId,
        userId: actor.userId,
        bucket: this.storageService.requireBucket(),
        key: stored.key,
        fileName: stored.fileName,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        isUploaded: true,
      })
      .catch(async (error: unknown) => {
        await this.removeFile(row, stored.key);
        throw error;
      });
    if (versionNumber === null) {
      await this.removeFile(row, stored.key);
      throw new NotFoundException('Document not found.');
    }

    await auditDocumentChange(this.databaseService, actor, {
      itemId,
      action: 'update',
      metadata: { newVersion: versionNumber, fileName: stored.fileName },
    });
    this.indexingWorker.requestRun();
    return toKnowledgeDocument(
      await this.lifecycle.findVisibleRow(actor, itemId),
    );
  };

  private storeFile = (
    row: KnowledgeDocumentRow,
    versionId: string,
    file: IncomingFile | undefined,
  ): Promise<StoredFile> =>
    row.tenant_id === null
      ? this.sharedLibraryStorage.uploadSharedDocument(
          file,
          this.sharedLibraryStorage.buildVersionKey(
            row.document_id,
            versionId,
            file?.originalname ?? 'document',
          ),
        )
      : this.storageService.uploadDocument(file, row.tenant_id);

  private removeFile = (
    row: KnowledgeDocumentRow,
    key: string,
  ): Promise<void> =>
    (row.tenant_id === null
      ? this.sharedLibraryStorage.deleteSharedDocumentFile(key)
      : this.storageService.deleteFile(key, row.tenant_id)
    ).catch(() => undefined);
}

// One version in flight at a time; archived documents stay archived.
export const assertAcceptsNewVersion = (row: KnowledgeDocumentRow): void => {
  const { state } = toKnowledgeDocument(row);
  if (state === 'archived')
    throw new ConflictException(
      'Archived documents can’t get new versions. Upload it as a new document.',
    );
  if (BUSY_STATES.includes(state))
    throw new ConflictException(
      'This document is still processing its latest version.',
    );
};
