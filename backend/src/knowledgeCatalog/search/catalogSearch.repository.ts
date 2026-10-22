import { PoolClient } from 'pg';
import { toLimitOffset } from '../../common/dto/paginationQueryDto';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import {
  CATALOG_COLUMNS,
  CATALOG_CTE,
  CATALOG_JOINS,
  buildCatalogConditions,
  toWhereClause,
} from '../catalogScope';
import { SearchCatalogQueryDto } from '../dto/searchCatalogQueryDto';
import { SearchHitRow } from '../types/catalogRows';

const HEADLINE_OPTIONS =
  'MaxWords=35, MinWords=15, MaxFragments=1, StartSel=<mark>, StopSel=</mark>';

// One hit per (document, page) over live versions, best first. Page text
// comes from document_pages; versions indexed before pages were saved use
// their chunks (each keeps the page it starts on). The hit's section is the
// best-matching one starting on that page, else the one running onto it.
// Run inside withActor(caller).
export const searchCatalogPages = async (
  client: PoolClient,
  access: KnowledgeAccess,
  query: SearchCatalogQueryDto,
): Promise<SearchHitRow[]> => {
  const params: unknown[] = [access.tenantId];
  const where = toWhereClause(
    buildCatalogConditions(access, query, params, { readableOnly: true }),
  );
  params.push(query.q);
  const queryParam = `$${params.length}`;
  const { limit, offset } = toLimitOffset(query);
  params.push(limit, offset);
  const result = await client.query<SearchHitRow>(
    `WITH ${CATALOG_CTE},
     scoped AS (SELECT c.* FROM catalog c ${where}),
     q AS (SELECT websearch_to_tsquery('english', ${queryParam}) AS query),
     page_text AS (
       SELECT p.document_version_id, p.page_number, p.content
       FROM document_pages p JOIN scoped s ON s.live_version_id = p.document_version_id
       UNION ALL
       SELECT ch.document_version_id, ch.page_number, ch.chunk_text
       FROM document_chunks ch JOIN scoped s ON s.live_version_id = ch.document_version_id
       WHERE NOT EXISTS (
         SELECT 1 FROM document_pages p WHERE p.document_version_id = ch.document_version_id)
     ),
     hits AS (
       SELECT DISTINCT ON (pt.document_version_id, pt.page_number)
              pt.document_version_id, pt.page_number, pt.content,
              ts_rank(to_tsvector('english', pt.content), q.query) AS rank
       FROM page_text pt CROSS JOIN q
       WHERE to_tsvector('english', pt.content) @@ q.query
       ORDER BY pt.document_version_id, pt.page_number, rank DESC
     )
     SELECT ${CATALOG_COLUMNS}, h.page_number AS hit_page, h.rank,
            ts_headline('english', h.content, q.query, '${HEADLINE_OPTIONS}') AS snippet,
            sec.ordinal AS section_ordinal, sec.heading AS section_heading,
            count(*) OVER () AS total_count
     FROM hits h
     JOIN scoped c ON c.live_version_id = h.document_version_id
     CROSS JOIN q
     ${CATALOG_JOINS}
     LEFT JOIN LATERAL (
       SELECT ds.ordinal, ds.heading FROM document_sections ds
       WHERE ds.document_version_id = h.document_version_id
         AND ds.page_number <= h.page_number
       ORDER BY ds.page_number = h.page_number
                  AND to_tsvector('english', coalesce(ds.heading, '') || ' ' || ds.content) @@ q.query DESC,
                ds.page_number DESC, ds.ordinal
       LIMIT 1
     ) sec ON true
     ORDER BY h.rank DESC, lower(c.title), h.page_number
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows;
};
