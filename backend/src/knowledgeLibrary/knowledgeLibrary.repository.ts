import { DatabaseService } from '../database/database.service';
import { SearchKnowledgeLibraryQueryDto } from './dto/searchKnowledgeLibraryQueryDto';
import {
  RESULT_COLUMNS,
  RESULT_LIMIT,
  buildVisibleItemsCte,
  orderBy,
} from './knowledgeLibraryScope';
import { KnowledgeResultRow } from './types/knowledgeLibraryRows';

// Chunks considered for the semantic ranking before grouping by document.
const SEMANTIC_CANDIDATES = 200;

// A document's opening passage, for `visible vi` rows with no better one.
const FIRST_PASSAGE_SQL = `
  SELECT c.chunk_text, c.page_number, c.section_heading FROM document_chunks c
  WHERE c.document_id = vi.document_id AND c.document_version_id = vi.live_version_id
  ORDER BY c.chunk_index LIMIT 1`;

// No query: every visible document, newest first, with its opening passage.
export const browseKnowledge = async (
  databaseService: DatabaseService,
  tenantId: string,
  filters: SearchKnowledgeLibraryQueryDto,
): Promise<KnowledgeResultRow[]> => {
  const params: unknown[] = [tenantId];
  const visible = buildVisibleItemsCte(filters, params);
  const result = await databaseService.query<KnowledgeResultRow>(
    `WITH ${visible}
     SELECT ${RESULT_COLUMNS}, NULL::float AS score
     FROM visible vi
     LEFT JOIN LATERAL (${FIRST_PASSAGE_SQL}) b ON true
     ${orderBy('newest')} LIMIT ${RESULT_LIMIT}`,
    params,
  );
  return result.rows;
};

// Full-text search on titles (weighted highest) and indexed passages. Any
// word matches ("rear suspension cylinder recharge" finds a document with
// only some of them); documents matching more words rank higher. Each
// document shows its best passage, or its opening one for a title match.
export const keywordSearchKnowledge = async (
  databaseService: DatabaseService,
  tenantId: string,
  filters: SearchKnowledgeLibraryQueryDto & { search: string },
): Promise<KnowledgeResultRow[]> => {
  const params: unknown[] = [tenantId];
  const visible = buildVisibleItemsCte(filters, params);
  params.push(filters.search);
  const queryParam = `$${params.length}`;
  const result = await databaseService.query<KnowledgeResultRow>(
    `WITH ${visible},
     q AS (
       SELECT replace(plainto_tsquery('english', ${queryParam})::text, '&', '|')::tsquery AS query
     ),
     passage_hits AS (
       SELECT DISTINCT ON (c.document_id) c.document_id, c.chunk_text, c.page_number,
              c.section_heading, ts_rank(to_tsvector('english', c.chunk_text), q.query) AS rank
       FROM document_chunks c
       JOIN visible vi ON vi.document_id = c.document_id AND c.document_version_id = vi.live_version_id
       CROSS JOIN q
       WHERE to_tsvector('english', c.chunk_text) @@ q.query
       ORDER BY c.document_id, rank DESC
     ),
     titled AS (
       SELECT vi.*, ts_rank(setweight(to_tsvector('english', vi.title), 'A'), q.query) AS title_rank
       FROM visible vi CROSS JOIN q
     )
     SELECT ${RESULT_COLUMNS}, COALESCE(h.rank, 0) + vi.title_rank AS score
     FROM titled vi
     LEFT JOIN passage_hits h ON h.document_id = vi.document_id
     LEFT JOIN LATERAL (
       SELECT h.chunk_text, h.page_number, h.section_heading WHERE h.document_id IS NOT NULL
       UNION ALL
       (${FIRST_PASSAGE_SQL.replace('WHERE', 'WHERE h.document_id IS NULL AND')})
     ) b ON true
     WHERE h.document_id IS NOT NULL OR vi.title_rank > 0
     ${orderBy(filters.sort)} LIMIT ${RESULT_LIMIT}`,
    params,
  );
  return result.rows;
};

// Nearest passages to the query embedding (HNSW index, migration 0013),
// grouped to each document's closest passage; score is cosine similarity.
export const semanticSearchKnowledge = async (
  databaseService: DatabaseService,
  tenantId: string,
  filters: SearchKnowledgeLibraryQueryDto & { queryVector: string },
): Promise<KnowledgeResultRow[]> => {
  const params: unknown[] = [tenantId];
  const visible = buildVisibleItemsCte(filters, params);
  params.push(filters.queryVector);
  const vectorParam = `$${params.length}::vector`;
  const result = await databaseService.query<KnowledgeResultRow>(
    `WITH ${visible},
     nearest AS (
       SELECT c.document_id, c.chunk_text, c.page_number, c.section_heading,
              1 - (c.embedding <=> ${vectorParam}) AS similarity
       FROM document_chunks c
       JOIN visible vi ON vi.document_id = c.document_id AND c.document_version_id = vi.live_version_id
       ORDER BY c.embedding <=> ${vectorParam}
       LIMIT ${SEMANTIC_CANDIDATES}
     ),
     best AS (
       SELECT DISTINCT ON (document_id) * FROM nearest ORDER BY document_id, similarity DESC
     )
     SELECT ${RESULT_COLUMNS}, b.similarity AS score
     FROM best b
     JOIN visible vi ON vi.document_id = b.document_id
     ${orderBy(filters.sort)} LIMIT ${RESULT_LIMIT}`,
    params,
  );
  return result.rows;
};
