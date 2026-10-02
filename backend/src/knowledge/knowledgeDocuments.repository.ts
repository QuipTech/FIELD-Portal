import { DatabaseService } from '../database/database.service';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { KnowledgeDocumentRow } from './types/knowledgeDocumentRows';

// Knowledge items with their latest document version. Scope is explicit
// in the SQL rather than left to RLS (the backend's DB role may bypass
// RLS): the shared library (tenant_id IS NULL) plus, when
// visibleToTenantId is set, that one organisation's own documents — or
// every organisation's, for the Owner ($7, includeAllTenants).
const KNOWLEDGE_DOCUMENTS_QUERY = `
  SELECT ki.id, ki.tenant_id, t.name AS organisation_name, ki.title, ki.type, ki.status, ki.created_at,
         ki.review_note, d.id AS document_id,
         dv.id AS version_id, dv.version_number, dv.indexing_progress, dv.error_message, dv.file_name, dv.content_type, dv.size_bytes,
         dv.page_count, dv.page_count_checked_at, dv.ingestion_status, dv.ingested_at,
         dv.storage_bucket, dv.storage_key,
         count(*) OVER () AS total_count
  FROM knowledge_items ki
  LEFT JOIN tenants t ON t.id = ki.tenant_id
  JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
  JOIN LATERAL (
    SELECT * FROM document_versions v
    WHERE v.document_id = d.id
    ORDER BY v.version_number DESC
    LIMIT 1
  ) dv ON true
  WHERE ki.deleted_at IS NULL
    AND (ki.tenant_id IS NULL OR ($6::uuid IS NOT NULL AND ki.tenant_id = $6)
         OR $7::boolean)
    AND ($1::uuid IS NULL OR ki.id = $1)
    AND ($2::varchar IS NULL
         OR ki.title ILIKE '%' || $2 || '%'
         OR dv.file_name ILIKE '%' || $2 || '%')
    AND ($3::varchar IS NULL OR ki.type = $3)
  ORDER BY ki.created_at DESC, ki.id
  LIMIT $4 OFFSET $5`;

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

export const listKnowledgeDocuments = async (
  databaseService: DatabaseService,
  filter: KnowledgeDocumentFilter,
): Promise<KnowledgeDocumentRow[]> => {
  const result = await databaseService.query<KnowledgeDocumentRow>(
    KNOWLEDGE_DOCUMENTS_QUERY,
    [
      null,
      filter.search ? escapeLikePattern(filter.search) : null,
      filter.type ?? null,
      filter.limit,
      filter.offset,
      filter.visibleToTenantId,
      filter.includeAllTenants ?? false,
    ],
  );
  return result.rows;
};

export const findKnowledgeDocument = async (
  databaseService: DatabaseService,
  itemId: string,
  visibleToTenantId: string | null,
  includeAllTenants = false,
): Promise<KnowledgeDocumentRow | null> => {
  const result = await databaseService.query<KnowledgeDocumentRow>(
    KNOWLEDGE_DOCUMENTS_QUERY,
    [itemId, null, null, 1, 0, visibleToTenantId, includeAllTenants],
  );
  return result.rows[0] ?? null;
};
