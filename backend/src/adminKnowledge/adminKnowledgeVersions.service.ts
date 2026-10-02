import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScope } from '../auth/adminScope/adminScope';
import { buildDocumentKey } from '../storage/storageKeys';
import { AdminKnowledgeService } from './adminKnowledge.service';
import { assertCanManageKnowledgeDocument } from './adminKnowledgeAccess';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import { StorageService } from '../storage/storage.service';
import { KnowledgeUploadTicket } from '../knowledge/types/knowledgeDocumentResponse';
import * as lifecycleRepository from '../documents/documentLifecycle.repository';
import { assertAcceptsNewVersion } from '../documents/documentVersions.service';
import { auditDocumentChange } from '../documents/documentAudit';
import { CreateVersionUploadDto } from './dto/createVersionUploadDto';

// A new version of a document the caller manages (the Owner: any),
// uploaded like a new one
// (browser → S3 directly, up to 500 MB): this records the version as
// 'uploading' and signs the PUT; POST …/upload-complete then queues it.
@Injectable()
export class AdminKnowledgeVersionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
    private readonly adminKnowledge: AdminKnowledgeService,
  ) {}

  createVersionUpload = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    itemId: string,
    dto: CreateVersionUploadDto,
  ): Promise<KnowledgeUploadTicket> => {
    const row = await this.adminKnowledge.findRow(scope, itemId);
    assertCanManageKnowledgeDocument(scope, row);
    assertAcceptsNewVersion(row);

    const versionId = randomUUID();
    // Organisation documents stay under that organisation's folder.
    const key = row.tenant_id
      ? buildDocumentKey(row.tenant_id, dto.fileName)
      : this.sharedLibraryStorage.buildVersionKey(
          row.document_id,
          versionId,
          dto.fileName,
        );
    const versionNumber = await lifecycleRepository.createDocumentVersion(
      this.databaseService,
      {
        itemId,
        versionId,
        userId: actor.userId,
        bucket: this.storageService.requireBucket(),
        key,
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        isUploaded: false,
      },
    );
    if (versionNumber === null)
      throw new NotFoundException('Document not found.');
    await auditDocumentChange(this.databaseService, actor, {
      itemId,
      action: 'update',
      metadata: { newVersion: versionNumber, fileName: dto.fileName },
    });

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
}
