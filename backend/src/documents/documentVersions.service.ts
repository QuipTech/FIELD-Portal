import {
  validateIncomingFile,
  DOCUMENT_RULE,
} from '../storage/storageFileRules';
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
import { IncomingFile } from '../storage/types/storedFile';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import { KnowledgeDocument } from '../knowledge/types/knowledgeDocumentResponse';
import * as lifecycleRepository from './documentLifecycle.repository';
import { assertCanManageDocument, loadActorAccess } from './documentAccess';
import { auditDocumentChange } from './documentAudit';
import { DocumentLifecycleService } from './documentLifecycle.service';

// An abandoned browser upload ('uploading' that never completed) doesn't
// block a new version — the new one simply supersedes it.
const BUSY_STATES = ['queued', 'indexing'];

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

    const { contentType } = validateIncomingFile(file, DOCUMENT_RULE);
    const versionId = randomUUID();
    const reserved = await lifecycleRepository.createDocumentVersion(
      this.databaseService,
      {
        itemId,
        versionId,
        userId: actor.userId,
        bucket: this.storageService.requireBucket(),
        fileName: file!.originalname,
        contentType,
        sizeBytes: file!.size,
      },
    );
    if (!reserved) throw new NotFoundException('Document not found.');
    try {
      await this.sharedLibraryStorage.uploadSharedDocument(file, reserved.key);
      await this.databaseService.query(
        'SELECT admin_finish_knowledge_upload($1,true)',
        [versionId],
      );
    } catch (error) {
      await this.databaseService.query(
        'SELECT admin_finish_knowledge_upload($1,false)',
        [versionId],
      );
      await this.sharedLibraryStorage
        .deleteSharedDocumentFile(reserved.key)
        .catch(() => undefined);
      throw error;
    }

    await auditDocumentChange(this.databaseService, actor, {
      itemId,
      action: 'update',
      metadata: {
        newVersion: reserved.versionNumber,
        fileName: file!.originalname,
      },
    });
    this.indexingWorker.requestRun();
    return toKnowledgeDocument(
      await this.lifecycle.findVisibleRow(actor, itemId),
    );
  };
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
