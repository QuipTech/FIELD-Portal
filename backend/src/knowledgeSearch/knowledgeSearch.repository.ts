import { DatabaseService } from '../database/database.service';
import { chunkSectionLateral } from '../knowledge/knowledgeSql';

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
// document isn't archived, withdrawn or deleted, and the caller may read it
// (knowledge_can_read_document: own organisation or shared library, active
// brand). Ordered by cosine distance (HNSW index, migration 0013); sections
// are looked up for the nearest chunks only.
// $4 narrows it to one document (Ask AI on a Knowledge article), $6 to one
// brand, $7 to one category.
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
                           AND ki.status NOT IN ('archived','withdrawn')
    WHERE knowledge_can_read_document(d.id,$2,$5)
      AND ($4::uuid IS NULL OR ki.id = $4)
      AND ($6::uuid IS NULL OR c.brand_id=$6)
      AND ($7::uuid IS NULL OR c.category_id=$7)
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
  databaseService: Pick<DatabaseService, 'query'>,
  params: {
    queryVector: string;
    tenantId: string;
    userId: string;
    brandId?: string;
    categoryId?: string;
    limit: number;
    documentId?: string | null;
  },
): Promise<ChunkMatchRow[]> => {
  const result = await databaseService.query<ChunkMatchRow>(LIVE_CHUNK_SEARCH, [
    params.queryVector,
    params.tenantId,
    params.limit,
    params.documentId ?? null,
    params.userId,
    params.brandId ?? null,
    params.categoryId ?? null,
  ]);
  return result.rows;
};
