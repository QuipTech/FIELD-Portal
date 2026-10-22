import { DatabaseService } from '../database/database.service';
import { ITEM_BRAND_SQL, chunkSectionLateral } from '../knowledge/knowledgeSql';

export interface ChunkMatchRow {
  chunk_id: string;
  knowledge_item_id: string;
  title: string;
  type: string;
  page_number: number | null;
  section_heading: string | null;
  chunk_text: string;
  similarity: number;
  // The chunk's section (knowledgeSql.chunkSectionLateral); null if unknown.
  section_ordinal: number | null;
  section_title: string | null;
}

// The only query AI retrieval uses. A chunk is searchable only when it
// belongs to its document's live version (documents.live_version_id), the
// document isn't archived or deleted, it's the caller's organisation's or
// the shared library's, and its brand is in the plan (or it has none).
// Scope is explicit in SQL (the backend's DB role may bypass RLS). Ordered
// by cosine distance (HNSW index, migration 0013).
// $4 narrows it to one document (Ask AI on a Knowledge article), $5 to one
// brand; $6 is the plan's brands (NULL = every brand).
const LIVE_CHUNK_SEARCH = `
  WITH nearest AS (
    SELECT c.id AS chunk_id, ki.id AS knowledge_item_id, ki.title, ki.type,
           c.page_number, c.section_heading, c.chunk_text, c.document_version_id,
           1 - (c.embedding <=> $1::vector) AS similarity
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
                    AND d.deleted_at IS NULL
                    AND d.live_version_id = c.document_version_id
    JOIN knowledge_items ki ON ki.id = d.knowledge_item_id
                           AND ki.deleted_at IS NULL
                           AND ki.status <> 'archived'
    CROSS JOIN LATERAL (SELECT ${ITEM_BRAND_SQL} AS brand_id) b
    WHERE (c.tenant_id IS NULL OR c.tenant_id = $2)
      AND ($4::uuid IS NULL OR ki.id = $4)
      AND ($5::uuid IS NULL OR b.brand_id = $5)
      AND ($6::uuid[] IS NULL OR b.brand_id IS NULL OR b.brand_id = ANY($6::uuid[]))
    ORDER BY c.embedding <=> $1::vector
    LIMIT $3
  )
  SELECT n.chunk_id, n.knowledge_item_id, n.title, n.type, n.page_number,
         n.section_heading, n.chunk_text, n.similarity,
         sec.ordinal AS section_ordinal, sec.heading AS section_title
  FROM nearest n
  ${chunkSectionLateral('n')}
  ORDER BY n.similarity DESC`;

export const searchLiveChunks = async (
  databaseService: DatabaseService,
  params: {
    queryVector: string;
    tenantId: string;
    limit: number;
    documentId?: string | null;
    brandId?: string | null;
    planBrandIds: string[] | null;
  },
): Promise<ChunkMatchRow[]> => {
  const result = await databaseService.query<ChunkMatchRow>(LIVE_CHUNK_SEARCH, [
    params.queryVector,
    params.tenantId,
    params.limit,
    params.documentId ?? null,
    params.brandId ?? null,
    params.planBrandIds,
  ]);
  return result.rows;
};
