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
import * as knowledgeSearchRepository from './knowledgeSearch.repository';

export interface KnowledgeMatch {
  chunkId: string;
  documentId: string;
  title: string;
  type: string;
  page: number | null;
  heading: string | null;
  text: string;
  // Cosine similarity, 0–1 (higher is closer).
  score: number;
}

// Retrieval for the AI assistant: embeds the question with the same model
// as the documents and returns the closest live chunks the caller may see.
@Injectable()
export class KnowledgeSearchService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly embedder: BedrockEmbedderService,
  ) {}

  search = async (
    actor: AuthenticatedUser,
    query: string,
    limit: number,
    // Only this document (a knowledge item id), within what the caller sees.
    documentId?: string,
  ): Promise<KnowledgeMatch[]> => {
    const queryVector = toVectorLiteral(
      await this.embedQuery(query, actor.tenantId),
    );
    const rows = await knowledgeSearchRepository.searchLiveChunks(
      this.databaseService,
      {
        queryVector,
        tenantId: actor.tenantId,
        limit,
        documentId,
      },
    );
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.knowledge_item_id,
      title: row.title,
      type: row.type,
      page: row.page_number,
      heading: row.section_heading,
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
