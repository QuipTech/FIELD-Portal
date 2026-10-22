import { PoolClient } from 'pg';
import { toLimitOffset } from '../../common/dto/paginationQueryDto';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import {
  CATALOG_COLUMNS,
  CATALOG_CTE,
  CATALOG_JOINS,
  buildCatalogConditions,
  toOrderByClause,
  toWhereClause,
} from '../catalogScope';
import { ListCatalogDocumentsQueryDto } from '../dto/listCatalogDocumentsQueryDto';
import {
  CatalogDocumentRow,
  CountedCatalogDocumentRow,
  SectionRow,
} from '../types/catalogRows';

// Run inside withActor(caller).

export const listCatalogDocuments = async (
  client: PoolClient,
  access: KnowledgeAccess,
  query: ListCatalogDocumentsQueryDto,
): Promise<CountedCatalogDocumentRow[]> => {
  const params: unknown[] = [access.tenantId];
  const where = toWhereClause(buildCatalogConditions(access, query, params));
  const { limit, offset } = toLimitOffset(query);
  params.push(limit, offset);
  const result = await client.query<CountedCatalogDocumentRow>(
    `WITH ${CATALOG_CTE}
     SELECT ${CATALOG_COLUMNS}, count(*) OVER () AS total_count
     FROM catalog c ${CATALOG_JOINS}
     ${where}
     ${toOrderByClause(query.sort)}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows;
};

// Any item the caller can read, whatever its state: the caller decides
// what a non-admin may open (catalogDocumentAccess.ts).
export const findCatalogDocument = async (
  client: PoolClient,
  tenantId: string,
  itemId: string,
): Promise<CatalogDocumentRow | null> => {
  const result = await client.query<CatalogDocumentRow>(
    `WITH ${CATALOG_CTE}
     SELECT ${CATALOG_COLUMNS} FROM catalog c ${CATALOG_JOINS}
     WHERE c.id = $2`,
    [tenantId, itemId],
  );
  return result.rows[0] ?? null;
};

export const listVersionSections = async (
  client: PoolClient,
  versionId: string,
): Promise<SectionRow[]> => {
  const result = await client.query<SectionRow>(
    `SELECT ordinal, heading, page_number, content FROM document_sections
     WHERE document_version_id = $1 ORDER BY ordinal`,
    [versionId],
  );
  return result.rows;
};
