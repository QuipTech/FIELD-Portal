import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  BedrockEmbedderService,
  toVectorLiteral,
} from '../knowledgeIndexing/embedding/bedrockEmbedder.service';
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
  ): Promise<KnowledgeMatch[]> => {
    const queryVector = toVectorLiteral(await this.embedder.embed(query));
    const rows = await knowledgeSearchRepository.searchLiveChunks(
      this.databaseService,
      {
        queryVector,
        tenantId: actor.tenantId,
        limit,
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
}
