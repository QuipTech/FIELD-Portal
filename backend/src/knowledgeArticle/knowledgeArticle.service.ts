import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { toDocumentDisplayTitle } from '../knowledge/documentDisplayTitle';
import * as articleRepository from './knowledgeArticle.repository';
import * as relatedRepository from './relatedDocuments.repository';
import { loadArticleSections, LoadedSection } from './loadArticleSections';
import { findArticleBlocker } from './articleAvailability';
import { toArticleSummary } from './articleSummary';
import {
  ArticleSection,
  KnowledgeArticle,
} from './types/knowledgeArticleResponse';
import { ArticleDocumentRow } from './types/knowledgeArticleRows';

const NOT_FOUND_MESSAGE = 'Document not found.';
const NOT_LIVE_MESSAGE = "This document isn't live yet.";

// A document as a readable article, for the caller's organisation's
// documents and the shared QuipTech library. Anything else is 404, never
// 403, so another organisation's document ids give nothing away.
@Injectable()
export class KnowledgeArticleService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getArticle = async (
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<KnowledgeArticle> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const row = await articleRepository.findArticleDocument(
        client,
        itemId,
        actor.tenantId,
      );
      if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
      const blocker = findArticleBlocker(row);
      if (blocker) {
        throw new ConflictException({
          statusCode: 409,
          message: NOT_LIVE_MESSAGE,
          state: blocker.state,
          progress: blocker.progress,
        });
      }
      const versionId = row.live_version_id!;
      const title = toDocumentDisplayTitle(row.title);
      const sections = await loadArticleSections(client, {
        id: versionId,
        title,
        fileName: row.file_name,
      });
      const lookup = { itemId: row.id, tenantId: actor.tenantId };
      const related = await relatedRepository.listRelatedDocuments(client, {
        ...lookup,
        versionId,
      });
      const bulletins = await relatedRepository.listApplicableBulletins(
        client,
        lookup,
      );
      return {
        id: row.id,
        title,
        type: row.type,
        machineMake: row.make_name,
        machineModel: row.model_name,
        revision: row.version_number ?? 1,
        pageCount: row.page_count,
        source: row.tenant_id === null ? 'quiptech_library' : 'tenant',
        state: 'live',
        fileName: row.file_name,
        pdfUrl: await this.signInlinePdf(row),
        summary: toArticleSummary(row.summary, sections[0]?.content ?? null),
        sections: await Promise.all(sections.map(this.toArticleSection)),
        related: related.map((link) => ({
          id: link.id,
          title: toDocumentDisplayTitle(link.title),
          type: link.type,
          page: link.page_number,
        })),
        appliesBulletins: bulletins.map((link) => ({
          id: link.id,
          title: toDocumentDisplayTitle(link.title),
        })),
      };
    });

  private toArticleSection = async (
    section: LoadedSection,
  ): Promise<ArticleSection> => ({
    id: `s${section.ordinal}`,
    heading: section.heading,
    page: section.page,
    content: section.content,
    figures: await Promise.all(
      section.figures.map(async (figure) => ({
        page: figure.page,
        caption: figure.caption,
        imageUrl: figure.imageStorageKey
          ? await this.signOrNull(figure.imageStorageKey)
          : null,
      })),
    ),
  });

  // No file name, so it opens in the browser instead of downloading.
  private signInlinePdf = (row: ArticleDocumentRow): Promise<string | null> =>
    row.storage_key ? this.signOrNull(row.storage_key) : Promise.resolve(null);

  private signOrNull = async (key: string): Promise<string | null> => {
    try {
      return (await this.storageService.getSignedDownloadUrl(key)).url;
    } catch {
      return null;
    }
  };
}
