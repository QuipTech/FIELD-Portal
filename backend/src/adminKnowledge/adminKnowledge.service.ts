import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as adminKnowledgeRepository from './adminKnowledge.repository';
import * as knowledgeDocumentsRepository from '../knowledge/knowledgeDocuments.repository';
import { StorageService } from '../storage/storage.service';
import { SharedLibraryStorageService } from '../storage/sharedLibraryStorage.service';
import { buildSharedDocumentKey } from '../storage/storageKeys';
import { SignedUrl } from '../storage/types/storedFile';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { signDocumentDownload } from '../knowledge/signDocumentDownload';
import { DocumentPageCountService } from '../knowledge/documentPageCount.service';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import { CreateKnowledgeUploadDto } from './dto/createKnowledgeUploadDto';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import {
  KnowledgeDocument,
  KnowledgeDocumentList,
  KnowledgeUploadTicket,
} from '../knowledge/types/knowledgeDocumentResponse';

const DOCUMENT_NOT_FOUND_MESSAGE = 'Document not found.';
const FIRST_VERSION = 1;

// Shared-library changes are audited under the acting admin's organisation.
@Injectable()
export class AdminKnowledgeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly sharedLibraryStorage: SharedLibraryStorageService,
    private readonly documentPageCount: DocumentPageCountService,
    private readonly indexingWorker: IndexingWorkerService,
  ) {}

  listDocuments = async (
    query: ListKnowledgeDocumentsQueryDto,
  ): Promise<KnowledgeDocumentList> => {
    const rows = await knowledgeDocumentsRepository.listKnowledgeDocuments(
      this.databaseService,
      {
        visibleToTenantId: null,
        search: query.search,
        type: query.type,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    );
    return {
      documents: rows.map(toKnowledgeDocument),
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  // Step 1 of an upload: records the document as 'uploading' and returns
  // a signed URL the browser PUTs the file to.
  createUpload = async (
    actor: AuthenticatedUser,
    dto: CreateKnowledgeUploadDto,
  ): Promise<KnowledgeUploadTicket> => {
    const bucket = this.storageService.requireBucket();
    const itemId = randomUUID();
    const documentId = randomUUID();
    const key = buildSharedDocumentKey(documentId, FIRST_VERSION, dto.fileName);

    await this.databaseService.withTenant(actor.tenantId, (client) =>
      adminKnowledgeRepository.createSharedUpload(client, {
        ...dto,
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
      document: toKnowledgeDocument(await this.findRow(itemId)),
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
    itemId: string,
  ): Promise<KnowledgeDocument> => {
    const row = await this.findRow(itemId);
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
      await adminKnowledgeRepository.finishSharedUpload(client, {
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
    return toKnowledgeDocument(await this.findRow(itemId));
  };

  createDownloadUrl = async (itemId: string): Promise<SignedUrl> =>
    signDocumentDownload(this.storageService, await this.findRow(itemId));

  private findRow = async (itemId: string): Promise<KnowledgeDocumentRow> => {
    const row = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      null,
    );
    if (!row) throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    return row;
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
