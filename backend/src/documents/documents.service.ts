import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import {
  IncomingFile,
  SignedUrl,
  UploadedFile,
} from '../storage/types/storedFile';
import * as knowledgeDocumentsRepository from '../knowledge/knowledgeDocuments.repository';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { toDocumentDisplayTitle } from '../knowledge/documentDisplayTitle';
import { signDocumentDownload } from '../knowledge/signDocumentDownload';
import { DocumentPageCountService } from '../knowledge/documentPageCount.service';
import { IndexingWorkerService } from '../knowledgeIndexing/indexingWorker.service';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import { KnowledgeDocument } from '../knowledge/types/knowledgeDocumentResponse';
import * as documentsRepository from './documents.repository';
import { UploadDocumentDto } from './dto/uploadDocumentDto';

const DOCUMENT_NOT_FOUND_MESSAGE = 'Document not found.';

export type ListedDocument = KnowledgeDocument & { downloadUrl: string | null };

@Injectable()
export class DocumentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly documentPageCount: DocumentPageCountService,
    private readonly indexingWorker: IndexingWorkerService,
  ) {}

  // S3 first, then the database; if the database write fails the object is
  // removed again so no orphan file is left behind.
  uploadDocument = async (
    actor: AuthenticatedUser,
    file: IncomingFile | undefined,
    dto: UploadDocumentDto,
  ): Promise<{ document: KnowledgeDocument; file: UploadedFile }> => {
    const stored = await this.storageService.uploadDocument(
      file,
      actor.tenantId,
    );
    const itemId = randomUUID();
    try {
      await this.databaseService.withTenant(actor.tenantId, async (client) => {
        await documentsRepository.insertTenantDocument(client, {
          itemId,
          documentId: randomUUID(),
          versionId: randomUUID(),
          tenantId: actor.tenantId,
          userId: actor.userId,
          title: dto.title ?? toDocumentDisplayTitle(stored.fileName),
          type: dto.type,
          bucket: this.storageService.requireBucket(),
          stored,
        });
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'knowledge_item',
          entityId: itemId,
          metadata: { fileName: stored.fileName, key: stored.key },
        });
      });
    } catch (error) {
      await this.storageService
        .deleteFile(stored.key, actor.tenantId)
        .catch(() => undefined);
      throw error;
    }
    this.documentPageCount.requestSweep();
    this.indexingWorker.requestRun();
    const { url } = await this.storageService.getSignedDownloadUrl(
      stored.key,
      stored.fileName,
    );
    return {
      document: toKnowledgeDocument(await this.findVisibleRow(actor, itemId)),
      file: { key: stored.key, signedUrl: url, uploadedAt: stored.uploadedAt },
    };
  };

  // The organisation's own documents plus the shared library, each with a
  // download URL signed now (valid 15 minutes).
  listDocuments = async (
    actor: AuthenticatedUser,
    query: ListKnowledgeDocumentsQueryDto,
  ) => {
    const rows = await knowledgeDocumentsRepository.listKnowledgeDocuments(
      this.databaseService,
      {
        visibleToTenantId: actor.tenantId,
        search: query.search,
        type: query.type,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    );
    const documents: ListedDocument[] = await Promise.all(
      rows.map(this.toListedDocument),
    );
    return {
      documents,
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  createDownloadUrl = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<SignedUrl> =>
    signDocumentDownload(
      this.storageService,
      await this.findVisibleRow(actor, itemId),
    );

  private toListedDocument = async (
    row: KnowledgeDocumentRow,
  ): Promise<ListedDocument> => {
    const isDownloadable =
      row.storage_key && row.ingestion_status !== 'uploading';
    const signed = isDownloadable
      ? await this.storageService.getSignedDownloadUrl(
          row.storage_key!,
          row.file_name ?? row.title,
        )
      : null;
    return { ...toKnowledgeDocument(row), downloadUrl: signed?.url ?? null };
  };

  private findVisibleRow = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<KnowledgeDocumentRow> => {
    const row = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      actor.tenantId,
    );
    if (!row) throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    return row;
  };
}
