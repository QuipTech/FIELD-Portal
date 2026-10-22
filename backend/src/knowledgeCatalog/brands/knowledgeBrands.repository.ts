import { PoolClient } from 'pg';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import {
  CATALOG_CTE,
  READABLE_SQL,
  buildCatalogConditions,
  toWhereClause,
} from '../catalogScope';

export interface BrandSummaryRow {
  id: string;
  name: string;
  document_count: string;
  category_count: string;
  machine_count: string;
  in_review_count: string;
  site_count: string;
  active_user_count: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
}

// Run inside withTenant(caller). A restricted plan lists exactly its
// brands; otherwise every brand with documents or with machines in the
// fleet. document_count is what technicians can open.
export const listBrandSummaries = async (
  client: PoolClient,
  access: KnowledgeAccess,
): Promise<BrandSummaryRow[]> => {
  const params: unknown[] = [access.tenantId];
  const where = toWhereClause(buildCatalogConditions(access, {}, params));
  params.push(access.brandIds);
  const allowedParam = `$${params.length}::uuid[]`;
  const result = await client.query<BrandSummaryRow>(
    `WITH ${CATALOG_CTE},
     scoped AS (SELECT c.* FROM catalog c ${where}),
     docs AS (
       SELECT c.brand_id, count(*) FILTER (WHERE ${READABLE_SQL}) AS document_count,
              count(*) FILTER (WHERE c.state = 'needs_review') AS in_review_count
       FROM scoped c WHERE c.brand_id IS NOT NULL GROUP BY c.brand_id
     ),
     fleet AS (
       SELECT m.manufacturer_id, count(*) AS machine_count,
              count(DISTINCT m.site) AS site_count
       FROM machines m WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.manufacturer_id
     ),
     viewers AS (
       SELECT c.brand_id, count(DISTINCT rv.user_id) AS active_user_count
       FROM knowledge_recent_views rv JOIN catalog c ON c.id = rv.knowledge_item_id
       WHERE rv.tenant_id = $1 AND rv.viewed_at > now() - interval '30 days'
       GROUP BY c.brand_id
     ),
     categories AS (
       SELECT manufacturer_id, count(*) AS category_count FROM knowledge_categories
       WHERE deleted_at IS NULL GROUP BY manufacturer_id
     )
     SELECT mf.id, mf.name,
            COALESCE(d.document_count, 0) AS document_count,
            COALESCE(k.category_count, 0) AS category_count,
            COALESCE(f.machine_count, 0) AS machine_count,
            COALESCE(d.in_review_count, 0) AS in_review_count,
            COALESCE(f.site_count, 0) AS site_count,
            COALESCE(v.active_user_count, 0) AS active_user_count
     FROM machine_manufacturers mf
     LEFT JOIN docs d ON d.brand_id = mf.id
     LEFT JOIN fleet f ON f.manufacturer_id = mf.id
     LEFT JOIN viewers v ON v.brand_id = mf.id
     LEFT JOIN categories k ON k.manufacturer_id = mf.id
     WHERE mf.deleted_at IS NULL
       AND CASE WHEN ${allowedParam} IS NULL
                THEN d.brand_id IS NOT NULL OR f.manufacturer_id IS NOT NULL
                ELSE mf.id = ANY(${allowedParam}) END
     ORDER BY mf.name`,
    params,
  );
  return result.rows;
};

export const findBrand = async (
  client: PoolClient,
  brandId: string,
): Promise<{ id: string; name: string } | null> => {
  const result = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM machine_manufacturers WHERE id = $1 AND deleted_at IS NULL`,
    [brandId],
  );
  return result.rows[0] ?? null;
};

export const findCategory = async (
  client: PoolClient,
  categoryId: string,
): Promise<CategoryRow | null> => {
  const result = await client.query<CategoryRow>(
    `SELECT kc.id, kc.name, mf.id AS brand_id, mf.name AS brand_name
     FROM knowledge_categories kc
     JOIN machine_manufacturers mf ON mf.id = kc.manufacturer_id AND mf.deleted_at IS NULL
     WHERE kc.id = $1 AND kc.deleted_at IS NULL`,
    [categoryId],
  );
  return result.rows[0] ?? null;
};
