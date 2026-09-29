import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import { StorageService } from '../storage/storage.service';
import * as knowledgeDocumentsRepository from '../knowledge/knowledgeDocuments.repository';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { KnowledgeUploadTicket } from '../knowledge/types/knowledgeDocumentResponse';
import * as lifecycleRepository from '../documents/documentLifecycle.repository';
import { assertAcceptsNewVersion } from '../documents/documentVersions.service';
import { auditDocumentChange } from '../documents/documentAudit';
import { CreateVersionUploadDto } from './dto/createVersionUploadDto';

// A new version of a shared-library document, uploaded like a new
// document (browser → S3 directly, up to 500 MB): this records the version
// as 'uploading' and signs the PUT; POST …/upload-complete then queues it.
@Injectable()
export class AdminKnowledgeVersionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
  ) {}

  createVersionUpload = async (
    actor: AuthenticatedUser,
    itemId: string,
    dto: CreateVersionUploadDto,
  ): Promise<KnowledgeUploadTicket> => {
    const row = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      null,
    );
    if (!row) throw new NotFoundException('Document not found.');
    assertAcceptsNewVersion(row);

    const versionId = randomUUID();
    const key = this.sharedLibraryStorage.buildVersionKey(
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
    const updated = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      null,
    );
    return {
      document: toKnowledgeDocument(updated!),
      upload: {
        ...signedUpload,
        method: 'PUT',
        headers: { 'Content-Type': dto.contentType },
      },
    };
  };
}
