import { DatabaseService } from '../database/database.service';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { KnowledgeDocumentRow } from './types/knowledgeDocumentRows';

export interface KnowledgeDocumentFilter {
  // null → shared library only; a tenant id → shared + that org's.
  visibleToTenantId: string | null;
  // The Owner (platform admin): every organisation's documents too.
  includeAllTenants?: boolean;
  search?: string;
  type?: string;
  limit: number;
  offset: number;
}

// Knowledge items with their latest document version
// (list_knowledge_documents, migration 0078). SECURITY DEFINER, so the
// Owner sees every organisation's documents despite RLS; the function
// applies the visibility filter itself.
const queryKnowledgeDocuments = (
  databaseService: DatabaseService,
  params: unknown[],
) =>
  databaseService.query<KnowledgeDocumentRow>(
    `SELECT * FROM list_knowledge_documents($1, $2, $3, $4, $5, $6, $7)`,
    params,
  );

export const listKnowledgeDocuments = async (
  databaseService: DatabaseService,
  filter: KnowledgeDocumentFilter,
): Promise<KnowledgeDocumentRow[]> => {
  const result = await queryKnowledgeDocuments(databaseService, [
    null,
    filter.search ? escapeLikePattern(filter.search) : null,
    filter.type ?? null,
    filter.limit,
    filter.offset,
    filter.visibleToTenantId,
    filter.includeAllTenants ?? false,
  ]);
  return result.rows;
};

export const findKnowledgeDocument = async (
  databaseService: DatabaseService,
  itemId: string,
  visibleToTenantId: string | null,
  includeAllTenants = false,
): Promise<KnowledgeDocumentRow | null> => {
  const result = await queryKnowledgeDocuments(databaseService, [
    itemId,
    null,
    null,
    1,
    0,
    visibleToTenantId,
    includeAllTenants,
  ]);
  return result.rows[0] ?? null;
};
