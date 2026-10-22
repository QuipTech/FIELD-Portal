import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeSearchService } from '../knowledgeSearch/knowledgeSearch.service';
import { KnowledgeAccessService } from '../knowledgeCatalog/access/knowledgeAccess.service';
import { assertCanOpenBrand } from '../knowledgeCatalog/access/knowledgeAccess';
import { findBrand } from '../knowledgeCatalog/brands/knowledgeBrands.repository';
import { loadVisibleDocument } from '../knowledgeCatalog/documents/catalogDocumentAccess';
import { MachineRow } from '../machineHistory/types/machineHistoryRows';
import { RetrievedChunk } from '../bedrock/types/technicalResponse';

const RETRIEVAL_LIMIT = 6;
// Cosine similarity below which an excerpt is noise, not a source.
const MIN_SOURCE_SCORE = 0.2;
const BRAND_NOT_FOUND_MESSAGE = 'Brand not found.';

export interface AskScope {
  documentId?: string;
  brandId?: string;
}

// The sources behind one answer. A chosen document or brand is checked
// like opening it in Knowledge (404 hidden, 403 brand not in the plan)
// before anything streams; retrieval itself always keeps to the plan.
@Injectable()
export class AiRetrievalService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeSearch: KnowledgeSearchService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  assertScopeAllowed = async (
    actor: AuthenticatedUser,
    scope: AskScope,
  ): Promise<void> => {
    if (!scope.documentId && !scope.brandId) return;
    const access = await this.knowledgeAccess.resolve(actor);
    await this.databaseService.withTenant(actor.tenantId, async (client) => {
      if (scope.documentId) {
        await loadVisibleDocument(client, access, scope.documentId);
      }
      if (scope.brandId) {
        const brand = await findBrand(client, scope.brandId);
        if (!brand) throw new NotFoundException(BRAND_NOT_FOUND_MESSAGE);
        assertCanOpenBrand(access, brand.id);
      }
    });
  };

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
