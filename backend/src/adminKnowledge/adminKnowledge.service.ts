import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import * as knowledgeDocumentsRepository from '../knowledge/knowledgeDocuments.repository';
import { StorageService } from '../storage/storage.service';
import { SignedUrl } from '../storage/types/storedFile';
import { toKnowledgeDocument } from '../knowledge/knowledgeDocumentMapper';
import { signDocumentDownload } from '../knowledge/signDocumentDownload';
import {
  canManageKnowledgeDocument,
  toKnowledgeVisibility,
} from './adminKnowledgeAccess';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';
import {
  KnowledgeDocument,
  KnowledgeDocumentList,
} from '../knowledge/types/knowledgeDocumentResponse';

const DOCUMENT_NOT_FOUND_MESSAGE = 'Document not found.';

// The admin Knowledge screen's reads for the caller's AdminScope: every
// document for the Owner. Uploads
// live in AdminKnowledgeUploadsService.
@Injectable()
export class AdminKnowledgeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  listDocuments = async (
    scope: AdminScope,
    query: ListKnowledgeDocumentsQueryDto,
  ): Promise<KnowledgeDocumentList> => {
    const rows = await knowledgeDocumentsRepository.listKnowledgeDocuments(
      this.databaseService,
      {
        ...toKnowledgeVisibility(scope),
        search: query.search,
        type: query.type,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
    );
    return {
      documents: rows.map((row) => this.toAdminDocument(scope, row)),
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  createDownloadUrl = async (
    scope: AdminScope,
    itemId: string,
  ): Promise<SignedUrl> =>
    signDocumentDownload(
      this.storageService,
      await this.findRow(scope, itemId),
    );

  // 404 for documents outside the caller's scope.
  findRow = async (
    scope: AdminScope,
    itemId: string,
  ): Promise<KnowledgeDocumentRow> => {
    const visibility = toKnowledgeVisibility(scope);
    const row = await knowledgeDocumentsRepository.findKnowledgeDocument(
      this.databaseService,
      itemId,
      visibility.visibleToTenantId,
      visibility.includeAllTenants,
    );
    if (!row) throw new NotFoundException(DOCUMENT_NOT_FOUND_MESSAGE);
    return row;
  };

  toAdminDocument = (
    scope: AdminScope,
    row: KnowledgeDocumentRow,
  ): KnowledgeDocument => ({
    ...toKnowledgeDocument(row),
    isEditable: canManageKnowledgeDocument(scope, row),
  });
}
