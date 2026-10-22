import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  KnowledgeSearchScope,
  KnowledgeSearchService,
} from '../knowledgeSearch/knowledgeSearch.service';
import { assertKnowledgeScope } from '../knowledge/knowledgeAccess';
import { MachineRow } from '../machineHistory/types/machineHistoryRows';
import { RetrievedChunk } from '../bedrock/types/technicalResponse';

const RETRIEVAL_LIMIT = 6;
// Cosine similarity below which an excerpt is noise, not a source.
const MIN_SOURCE_SCORE = 0.2;

export type AskScope = KnowledgeSearchScope;

export const hasAskScope = (scope: AskScope): boolean =>
  Boolean(scope.documentId || scope.brandId || scope.categoryId);

// The sources behind one answer. A chosen document, brand or category is
// checked like opening it in Knowledge (404 when hidden) before anything
// streams; retrieval itself always keeps to what the caller may read.
@Injectable()
export class AiRetrievalService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeSearch: KnowledgeSearchService,
  ) {}

  assertScopeAllowed = (
    actor: AuthenticatedUser,
    scope: AskScope,
  ): Promise<void> => assertKnowledgeScope(this.databaseService, actor, scope);

  // The machine's make and model steer retrieval toward its manuals. With
  // documentId, its closest passages are used however weak the match: the
  // technician chose the source.
  retrieveChunks = async (
    actor: AuthenticatedUser,
    question: string,
    machine: MachineRow | null,
    scope: AskScope,
  ): Promise<RetrievedChunk[]> => {
    const query = machine
      ? `${machine.manufacturer_name} ${machine.model_name}: ${question}`
      : question;
    const matches = await this.knowledgeSearch.search(
      actor,
      query,
      RETRIEVAL_LIMIT,
      scope,
    );
    return matches
      .filter((match) => scope.documentId || match.score >= MIN_SOURCE_SCORE)
      .map((match) => ({
        chunkId: match.chunkId,
        documentId: match.documentId,
        title: match.title,
        page: match.page,
        heading: match.heading,
        sectionId: match.sectionId,
        text: match.text,
      }));
  };
}
