import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { StorageService } from '../../storage/storage.service';
import { toDocumentDisplayTitle } from '../../knowledge/documentDisplayTitle';
import { loadArticleSections } from '../../knowledgeArticle/loadArticleSections';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { loadReadableDocument } from '../documents/catalogDocumentAccess';
import { CatalogDocumentPage } from '../types/catalogDocumentResponse';
import { findDocumentPage } from './documentPages.repository';
import { findPageSections, toSectionsText } from './pageSections';

const PAGE_NOT_FOUND_MESSAGE = 'Page not found.';

// One page of a live document for the app's reader.
@Injectable()
export class DocumentPagesService {
  private readonly logger = new Logger(DocumentPagesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  getPage = async (
    actor: AuthenticatedUser,
    itemId: string,
    page: number,
  ): Promise<CatalogDocumentPage> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const loaded = await this.databaseService.withActor(
      actor,
      async (client) => {
        const row = await loadReadableDocument(client, access, itemId);
        if (page < 1 || (row.page_count !== null && page > row.page_count)) {
          throw new NotFoundException(PAGE_NOT_FOUND_MESSAGE);
        }
        const sections = await loadArticleSections(client, {
          id: row.live_version_id,
          title: toDocumentDisplayTitle(row.title),
          fileName: row.file_name,
        });
        const saved = await findDocumentPage(client, row.live_version_id, page);
        return { row, saved, pageSections: findPageSections(sections, page) };
      },
    );
    const { row, saved, pageSections } = loaded;
    return {
      documentId: row.id,
      versionId: row.live_version_id,
      versionNumber: row.version_number,
      page,
      pageCount: row.page_count,
      text: saved ? saved.content : toSectionsText(pageSections),
      textSource: saved ? 'page' : 'sections',
      sections: pageSections.map((entry) => entry.ref),
      imageUrl: saved?.image_storage_key
        ? await this.signOrNull(saved.image_storage_key)
        : null,
      pdfUrl: row.storage_key
        ? await this.signOrNull(row.storage_key, `#page=${page}`)
        : null,
    };
  };

  // No file name, so the PDF opens inline (at the page, via the fragment).
  private signOrNull = async (
    key: string,
    fragment = '',
  ): Promise<string | null> => {
    try {
      return (
        (await this.storageService.getSignedDownloadUrl(key)).url + fragment
      );
    } catch (error) {
      this.logger.warn(`Couldn't sign ${key}: ${String(error)}`);
      return null;
    }
  };
}
