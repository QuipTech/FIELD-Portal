import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  BedrockEmbedderService,
  toVectorLiteral,
} from '../knowledgeIndexing/embedding/bedrockEmbedder.service';
import * as libraryRepository from './knowledgeLibrary.repository';
import * as facetsRepository from './knowledgeLibraryFacets.repository';
import { toKnowledgeResult, toTotal } from './knowledgeLibraryMapper';
import { SearchKnowledgeLibraryQueryDto } from './dto/searchKnowledgeLibraryQueryDto';
import {
  KnowledgeLibraryResults,
  LibrarySearchMode,
} from './types/knowledgeLibraryResponse';
import { KnowledgeResultRow } from './types/knowledgeLibraryRows';

const SEMANTIC_RETRY_DELAY_MS = 5 * 60_000;

// The Knowledge screen's search. Tries AI (semantic) ranking first; if the
// embedding model can't be reached it falls back to full-text keyword
// search rather than failing, and says which it used.
@Injectable()
export class KnowledgeLibraryService {
  private readonly logger = new Logger(KnowledgeLibraryService.name);
  private semanticRetryAt = 0;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embedder: BedrockEmbedderService,
  ) {}

  search = async (
    actor: AuthenticatedUser,
    filters: SearchKnowledgeLibraryQueryDto,
  ): Promise<KnowledgeLibraryResults> => {
    const { rows, searchMode } = await this.findResults(
      actor.tenantId,
      filters,
    );
    const makes = await facetsRepository.listMentionedMakes(
      this.databaseService,
      actor.tenantId,
    );
    const modelName = filters.model
      ? await facetsRepository.findModelDisplayName(
          this.databaseService,
          filters.model,
        )
      : null;
    return {
      items: rows.map(toKnowledgeResult),
      total: toTotal(rows),
      searchMode,
      makes,
      activeModel:
        filters.model && modelName
          ? { id: filters.model, name: modelName }
          : null,
    };
  };

  private findResults = async (
    tenantId: string,
    filters: SearchKnowledgeLibraryQueryDto,
  ): Promise<{ rows: KnowledgeResultRow[]; searchMode: LibrarySearchMode }> => {
    const search = filters.search;
    if (!search) {
      return {
        rows: await libraryRepository.browseKnowledge(
          this.databaseService,
          tenantId,
          filters,
        ),
        searchMode: 'browse',
      };
    }
    const queryVector = await this.embedQuery(search, tenantId);
    if (queryVector) {
      return {
        rows: await libraryRepository.semanticSearchKnowledge(
          this.databaseService,
          tenantId,
          { ...filters, queryVector },
        ),
        searchMode: 'semantic',
      };
    }
    return {
      rows: await libraryRepository.keywordSearchKnowledge(
        this.databaseService,
        tenantId,
        { ...filters, search },
      ),
      searchMode: 'keyword',
    };
  };

  // Null when the embedding model can't be used (not set up, no access,
  // network); the caller then searches by keyword instead. After a failure
  // it isn't retried for a while, so searches don't each wait on it.
  private embedQuery = async (
    query: string,
    tenantId: string,
  ): Promise<string | null> => {
    if (Date.now() < this.semanticRetryAt) return null;
    try {
      return toVectorLiteral(
        await this.embedder.embedSearchQuery(query, tenantId),
      );
    } catch (error) {
      this.semanticRetryAt = Date.now() + SEMANTIC_RETRY_DELAY_MS;
      this.logger.warn(
        `Semantic search unavailable, using keyword search: ${String(error)}`,
      );
      return null;
    }
  };
}
