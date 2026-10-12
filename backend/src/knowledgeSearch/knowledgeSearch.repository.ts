import { DatabaseService } from '../database/database.service';

export interface ChunkMatchRow {
  chunk_id: string;
  knowledge_item_id: string;
  title: string;
  type: string;
  page_number: number | null;
  section_heading: string | null;
  chunk_text: string;
  similarity: number;
}

// The only query AI retrieval uses. A chunk is searchable only when it
// belongs to its document's live version (documents.live_version_id), the
// document isn't archived or deleted, and it's the caller's organisation's
// or the shared library's. Scope is explicit in SQL (the backend's DB role
// may bypass RLS). Ordered by cosine distance (HNSW index, migration 0013).
// $4 narrows it to one document (Ask AI on a Knowledge article).
const LIVE_CHUNK_SEARCH = `
  SELECT c.id AS chunk_id, ki.id AS knowledge_item_id, ki.title, ki.type,
         c.page_number, c.section_heading, c.chunk_text,
         1 - (c.embedding <=> $1::vector) AS similarity
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
                  AND d.deleted_at IS NULL
                  AND d.live_version_id = c.document_version_id
  JOIN knowledge_items ki ON ki.id = d.knowledge_item_id
                         AND ki.deleted_at IS NULL
                         AND ki.status <> 'archived'
  WHERE (c.tenant_id IS NULL OR c.tenant_id = $2)
    AND ($4::uuid IS NULL OR ki.id = $4)
  ORDER BY c.embedding <=> $1::vector
  LIMIT $3`;

export const searchLiveChunks = async (
  databaseService: DatabaseService,
  params: {
    queryVector: string;
    tenantId: string;
    limit: number;
    documentId?: string | null;
  },
): Promise<ChunkMatchRow[]> => {
  const result = await databaseService.query<ChunkMatchRow>(LIVE_CHUNK_SEARCH, [
    params.queryVector,
    params.tenantId,
    params.limit,
    params.documentId ?? null,
  ]);
  return result.rows;
};
