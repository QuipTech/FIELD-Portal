import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  BedrockEmbedderService,
  toVectorLiteral,
} from '../knowledgeIndexing/embedding/bedrockEmbedder.service';
import {
  BEDROCK_SETUP_ERRORS,
  bedrockErrorName,
} from '../bedrock/retryBedrockCall';
import { toSectionId } from '../knowledge/sectionId';
import { KnowledgeAccessService } from '../knowledgeCatalog/access/knowledgeAccess.service';
import * as knowledgeSearchRepository from './knowledgeSearch.repository';

export interface KnowledgeMatch {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  page: number | null;
  heading: string | null;
  // "4.3", or `s{ordinal}`; null when the version has no saved sections.
  sectionId: string | null;
  text: string;
  // Cosine similarity, 0–1 (higher is closer).
  score: number;
}

// Narrows retrieval to one document (a knowledge item id) or one brand,
// within what the caller sees.
export interface KnowledgeSearchScope {
  documentId?: string;
  brandId?: string;
}

// Retrieval for the AI assistant: embeds the question with the same model
// as the documents and returns the closest live chunks the caller may see
// (own organisation + shared library, brands in the plan).
@Injectable()
export class KnowledgeSearchService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embedder: BedrockEmbedderService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  search = async (
    actor: AuthenticatedUser,
    query: string,
    limit: number,
    scope: KnowledgeSearchScope = {},
  ): Promise<KnowledgeMatch[]> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const queryVector = toVectorLiteral(
      await this.embedQuery(query, actor.tenantId),
    );
    const rows = await knowledgeSearchRepository.searchLiveChunks(
      this.databaseService,
      {
        queryVector,
        tenantId: actor.tenantId,
        limit,
        documentId: scope.documentId,
        brandId: scope.brandId,
        planBrandIds: access.brandIds,
      },
    );
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.knowledge_item_id,
      title: row.title,
      type: row.type,
      page: row.page_number,
      heading: row.section_heading,
      sectionId:
        row.section_ordinal === null
          ? null
          : toSectionId(row.section_ordinal, row.section_title),
      text: row.chunk_text,
      score: Number(row.similarity),
    }));
  };

  // Setup problems (no Bedrock access, model not in this region) become a
  // clear 503 instead of a generic 500.
  private embedQuery = async (
    query: string,
    tenantId: string,
  ): Promise<number[]> => {
    try {
      return await this.embedder.embedSearchQuery(query, tenantId);
    } catch (error) {
      if (BEDROCK_SETUP_ERRORS.includes(bedrockErrorName(error))) {
        throw new ServiceUnavailableException(
          'AI search isn’t set up: no access to the Bedrock embedding model.',
        );
      }
      throw error;
    }
  };
}
