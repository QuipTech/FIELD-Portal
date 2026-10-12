import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import * as knowledgeDocumentsRepository from '../knowledge/knowledgeDocuments.repository';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import { KnowledgeDocument } from '../knowledge/types/knowledgeDocumentResponse';
import * as lifecycleRepository from './documentLifecycle.repository';
import { DocumentTransition } from './documentLifecycle.repository';
import {
  assertCanManageDocument,
  assertCanReview,
  loadActorAccess,
} from './documentAccess';
import { auditDocumentChange } from './documentAudit';

const DOCUMENT_NOT_FOUND_MESSAGE = 'Document not found.';

// Why a transition isn't allowed right now, per action.
const INVALID_STATE_MESSAGES: Record<DocumentTransition, string> = {
  approve: 'Only documents that need review can be approved.',
  reject: 'Only documents that need review can be rejected.',
  archive: 'Only live documents can be archived.',
  retry: 'Only failed documents can be retried.',
};

export interface DocumentStatus {
  state: KnowledgeDocument['state'];
  progress: number;
  indexedAt: string | null;
  errorMessage: string | null;
  versionNumber: number;
}

@Injectable()
export class DocumentLifecycleService {
  private readonly logger = new Logger(DocumentLifecycleService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
    private readonly indexingWorker: IndexingWorkerService,
  ) {}

  getStatus = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<DocumentStatus> => {
    const { state, progress, indexedAt, errorMessage, versionNumber } =
      toKnowledgeDocument(await this.findVisibleRow(actor, itemId));
    return { state, progress, indexedAt, errorMessage, versionNumber };
  };

  transition = async (
    actor: AuthenticatedUser,
    itemId: string,
    action: DocumentTransition,
    note?: string,
  ): Promise<KnowledgeDocument> => {
    const row = await this.findVisibleRow(actor, itemId);
    const access = await loadActorAccess(this.databaseService, actor);
    if (action === 'approve' || action === 'reject') assertCanReview(access);
    assertCanManageDocument(row, access);

    const outcome = await lifecycleRepository.transitionDocument(
      this.databaseService,
      {
        itemId,
        action,
        userId: actor.userId,
        note,
      },
    );
    if (outcome === 'not_found')
      throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    if (outcome === 'invalid_state')
      throw new ConflictException(INVALID_STATE_MESSAGES[action]);

    await auditDocumentChange(this.databaseService, actor, {
      itemId,
      action: 'update',
      metadata: {
        transition: action,
        from: toKnowledgeDocument(row).state,
        note: note ?? null,
      },
    });
    if (action === 'retry') this.indexingWorker.requestRun();
    return toKnowledgeDocument(await this.findVisibleRow(actor, itemId));
  };

  // Permanent: chunks, versions and rows go in one database transaction;
  // then every version's file is removed from S3 (logged if that fails —
  // the document is already gone).
  deleteDocument = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<void> => {
    const row = await this.findVisibleRow(actor, itemId);
    assertCanManageDocument(
      row,
      await loadActorAccess(this.databaseService, actor),
    );
    const keys = await lifecycleRepository.deleteDocumentPermanently(
      this.databaseService,
      itemId,
    );
    await auditDocumentChange(this.databaseService, actor, {
      itemId,
      action: 'delete',
      metadata: { title: row.title, files: keys.length },
    });
    for (const key of keys) {
      const deletion =
        row.tenant_id === null
          ? this.sharedLibraryStorage.deleteSharedDocumentFile(key)
          : this.storageService.deleteFile(key, row.tenant_id);
      await deletion.catch((error: unknown) =>
        this.logger.warn(`Couldn't delete ${key}: ${String(error)}`),
      );
    }
  };

  // Shared library + the actor's organisation; the Owner (platform
  // permission) can reach every organisation's documents.
  findVisibleRow = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<KnowledgeDocumentRow> => {
    const access = await loadActorAccess(this.databaseService, actor);
    const row = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      actor.tenantId,
      access.permissions.includes(PLATFORM_PERMISSION_CODE),
    );
    if (!row) throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    return row;
  };
}
