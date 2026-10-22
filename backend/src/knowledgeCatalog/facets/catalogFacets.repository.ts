import { PoolClient } from 'pg';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import {
  CATALOG_CTE,
  buildCatalogConditions,
  toWhereClause,
} from '../catalogScope';
import { CatalogFilters } from '../types/catalogFilters';
import { FacetRow, TypeFacetRow } from '../types/catalogRows';

// `scoped`: the readable documents the caller may open, narrowed by
// `filters`. Facets count what a technician would find, so admins get the
// same numbers (in-review counts are on GET /knowledge/brands).
const withScoped = (
  access: KnowledgeAccess,
  filters: CatalogFilters,
): { sql: string; params: unknown[] } => {
  const params: unknown[] = [access.tenantId];
  const where = toWhereClause(
    buildCatalogConditions(access, filters, params, { readableOnly: true }),
  );
  return {
    sql: `WITH ${CATALOG_CTE}, scoped AS (SELECT c.* FROM catalog c ${where})`,
    params,
  };
};

// Run inside withTenant(caller).

export const listBrandFacets = async (
  client: PoolClient,
  access: KnowledgeAccess,
): Promise<FacetRow[]> => {
  const scoped = withScoped(access, {});
  const result = await client.query<FacetRow>(
    `${scoped.sql}
     SELECT mf.id, mf.name, NULL::uuid AS brand_id, count(*) AS document_count
     FROM scoped c JOIN machine_manufacturers mf ON mf.id = c.brand_id
     GROUP BY mf.id, mf.name ORDER BY mf.name`,
    scoped.params,
  );
  return result.rows;
};

// Every category of the brands the caller may open (empty ones included,
// so a brand page shows its whole structure).
export const listCategoryFacets = async (
  client: PoolClient,
  access: KnowledgeAccess,
  brandId?: string,
): Promise<FacetRow[]> => {
  const scoped = withScoped(access, { brandId });
  const params = [...scoped.params, brandId ?? null, access.brandIds];
  const brandParam = `$${params.length - 1}`;
  const allowedParam = `$${params.length}`;
  const result = await client.query<FacetRow>(
    `${scoped.sql}
     SELECT kc.id, kc.name, kc.manufacturer_id AS brand_id, count(c.id) AS document_count
     FROM knowledge_categories kc
     LEFT JOIN scoped c ON c.category_id = kc.id
     WHERE kc.deleted_at IS NULL
       AND (${brandParam}::uuid IS NULL OR kc.manufacturer_id = ${brandParam}::uuid)
       AND (${allowedParam}::uuid[] IS NULL OR kc.manufacturer_id = ANY(${allowedParam}::uuid[]))
     GROUP BY kc.id, kc.name, kc.manufacturer_id, kc.sort_order
     ORDER BY kc.sort_order, kc.name`,
    params,
  );
  return result.rows;
};

export const listModelFacets = async (
  client: PoolClient,
  access: KnowledgeAccess,
  filters: CatalogFilters,
): Promise<FacetRow[]> => {
  const scoped = withScoped(access, filters);
  const result = await client.query<FacetRow>(
    `${scoped.sql}
     SELECT mm.id, mf.name || ' ' || mm.name AS name, mm.manufacturer_id AS brand_id,
            count(DISTINCT c.id) AS document_count
     FROM scoped c
     JOIN knowledge_item_machine_models km ON km.knowledge_item_id = c.id
     JOIN machine_models mm ON mm.id = km.machine_model_id AND mm.deleted_at IS NULL
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
     GROUP BY mm.id, mf.name, mm.name, mm.manufacturer_id
     ORDER BY mf.name, mm.name`,
    scoped.params,
  );
  return result.rows;
};

export const listTypeFacets = async (
  client: PoolClient,
  access: KnowledgeAccess,
  filters: CatalogFilters,
): Promise<TypeFacetRow[]> => {
  const scoped = withScoped(access, filters);
  const result = await client.query<TypeFacetRow>(
    `${scoped.sql}
     SELECT c.type, count(*) AS document_count FROM scoped c
     GROUP BY c.type ORDER BY c.type`,
    scoped.params,
  );
  return result.rows;
};
