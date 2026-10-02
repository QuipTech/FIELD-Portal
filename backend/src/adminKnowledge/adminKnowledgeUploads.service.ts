import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as adminKnowledgeRepository from './adminKnowledge.repository';
import { StorageService } from '../storage/storage.service';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import {
  buildDocumentKey,
  buildSharedDocumentKey,
} from '../storage/storageKeys';
import { DocumentPageCountService } from '../knowledge/documentPageCount.service';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import { CreateKnowledgeUploadDto } from './dto/createKnowledgeUploadDto';
import { assertCanManageKnowledgeDocument } from './adminKnowledgeAccess';
import { AdminKnowledgeService } from './adminKnowledge.service';
import {
  KnowledgeDocument,
  KnowledgeUploadTicket,
} from '../knowledge/types/knowledgeDocumentResponse';

const FIRST_VERSION = 1;

// Two-step uploads from the admin Knowledge screen (signed S3 PUT, then
// confirm). The Owner's uploads go to the shared library. Audited under the acting admin's
// organisation.
@Injectable()
export class AdminKnowledgeUploadsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
    private readonly documentPageCount: DocumentPageCountService,
    private readonly indexingWorker: IndexingWorkerService,
    private readonly adminKnowledge: AdminKnowledgeService,
  ) {}

  // Step 1 of an upload: records the document as 'uploading' and returns
  // a signed URL the browser PUTs the file to. The Owner's uploads go to
  // the shared library; an organisation-scoped upload would be stored
  // under that organisation's folder.
  createUpload = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    dto: CreateKnowledgeUploadDto,
  ): Promise<KnowledgeUploadTicket> => {
    const bucket = this.storageService.requireBucket();
    const itemId = randomUUID();
    const documentId = randomUUID();
    const key = scope.tenantId
      ? buildDocumentKey(scope.tenantId, dto.fileName)
      : buildSharedDocumentKey(documentId, FIRST_VERSION, dto.fileName);

    await this.databaseService.withTenant(actor.tenantId, (client) =>
      adminKnowledgeRepository.createKnowledgeUpload(client, {
        ...dto,
        tenantId: scope.tenantId,
        itemId,
        documentId,
        versionId: randomUUID(),
        userId: actor.userId,
        bucket,
        key,
      }),
    );
    const signedUpload = await this.sharedLibraryStorage.createSignedUploadUrl(
      key,
      dto.contentType,
    );
    return {
      document: this.adminKnowledge.toAdminDocument(
        scope,
        await this.adminKnowledge.findRow(scope, itemId),
      ),
      upload: {
        ...signedUpload,
        method: 'PUT',
        headers: { 'Content-Type': dto.contentType },
      },
    };
  };

  // Step 2: confirms the file really reached S3 (and is the size that was
  // declared) before queueing it for ingestion.
  completeUpload = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    itemId: string,
  ): Promise<KnowledgeDocument> => {
    const row = await this.adminKnowledge.findRow(scope, itemId);
    assertCanManageKnowledgeDocument(scope, row);
    if (
      row.ingestion_status !== 'uploading' ||
      !row.storage_bucket ||
      !row.storage_key
    ) {
      throw new ConflictException('This document has already been uploaded.');
    }
    const storedSize = await this.sharedLibraryStorage.findObjectSize(
      row.storage_key,
    );
    if (storedSize === null) {
      throw new ConflictException(
        "The file hasn't reached storage yet. Upload it, then try again.",
      );
    }
    const isExpectedSize = storedSize === Number(row.size_bytes);

    await this.runAudited(actor, itemId, 'create', async (client) => {
      await adminKnowledgeRepository.finishKnowledgeUpload(client, {
        versionId: row.version_id,
        succeeded: isExpectedSize,
      });
      return {
        title: row.title,
        fileName: row.file_name,
        sizeBytes: storedSize,
      };
    });
    if (!isExpectedSize) {
      throw new BadRequestException(
        "The uploaded file doesn't match the declared size. Upload it again.",
      );
    }
    this.documentPageCount.requestSweep();
    this.indexingWorker.requestRun();
    return this.adminKnowledge.toAdminDocument(
      scope,
      await this.adminKnowledge.findRow(scope, itemId),
    );
  };

  // The change and its audit entry commit together or not at all.
  private runAudited = (
    actor: AuthenticatedUser,
    itemId: string,
    action: 'create',
    applyChange: (client: PoolClient) => Promise<Record<string, unknown>>,
  ): Promise<void> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const metadata = await applyChange(client);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action,
        entityType: 'knowledge_item',
        entityId: itemId,
        metadata,
      });
    });
}
