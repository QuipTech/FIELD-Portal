import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { StorageService } from '../../storage/storage.service';
import { toDocumentDisplayTitle } from '../../knowledge/documentDisplayTitle';
import { loadArticleSections } from '../../knowledgeArticle/loadArticleSections';
import { toArticleSummary } from '../../knowledgeArticle/articleSummary';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { toCatalogDocument, toSectionRef } from '../catalogDocumentMapper';
import { findLastViewedPage } from '../myKnowledge/myKnowledge.repository';
import {
  CatalogDocumentContents,
  CatalogDocumentFile,
} from '../types/catalogDocumentResponse';
import {
  loadReadableDocument,
  loadVisibleDocument,
} from './catalogDocumentAccess';

const FILE_NOT_READY_MESSAGE =
  "This document's file hasn't finished uploading.";

@Injectable()
export class CatalogDocumentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  getContents = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<CatalogDocumentContents> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withActor(actor, async (client) => {
      const row = await loadVisibleDocument(client, access, itemId);
      const sections = row.live_version_id
        ? await loadArticleSections(client, {
            id: row.live_version_id,
            title: toDocumentDisplayTitle(row.title),
            fileName: row.file_name,
          })
        : [];
      return {
        ...toCatalogDocument(row, access),
        summary: toArticleSummary(row.summary, sections[0]?.content ?? null),
        sections: sections.map(toSectionRef),
        lastViewedPage: await findLastViewedPage(client, actor.userId, itemId),
        reviewNote: access.isAdmin ? row.review_note : null,
        errorMessage: access.isAdmin ? row.error_message : null,
      };
    });
  };

  // The live version as an attachment, for offline use.
  getFile = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<CatalogDocumentFile> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const row = await this.databaseService.withActor(actor, (client) =>
      loadReadableDocument(client, access, itemId),
    );
    if (!row.storage_key) throw new ConflictException(FILE_NOT_READY_MESSAGE);
    const signed = await this.storageService.getSignedDownloadUrl(
      row.storage_key,
      row.file_name ?? toDocumentDisplayTitle(row.title),
    );
    return {
      ...signed,
      fileName: row.file_name,
      contentType: row.content_type,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      versionId: row.live_version_id,
      versionNumber: row.version_number,
    };
  };
}
