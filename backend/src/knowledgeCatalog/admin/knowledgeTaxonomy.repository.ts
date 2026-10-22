import { PoolClient } from 'pg';

export interface CategoryRecordRow {
  id: string;
  brand_id: string;
  name: string;
  sort_order: number;
}

export interface BrandAccessRow {
  id: string;
  name: string;
  has_access: boolean;
}

const CATEGORY_COLUMNS = 'id, manufacturer_id AS brand_id, name, sort_order';

export const insertCategory = async (
  client: PoolClient,
  category: { brandId: string; name: string; sortOrder: number },
): Promise<CategoryRecordRow> => {
  const result = await client.query<CategoryRecordRow>(
    `INSERT INTO knowledge_categories (manufacturer_id, name, sort_order)
     VALUES ($1, $2, $3) RETURNING ${CATEGORY_COLUMNS}`,
    [category.brandId, category.name, category.sortOrder],
  );
  return result.rows[0];
};

export const updateCategory = async (
  client: PoolClient,
  categoryId: string,
  changes: { name?: string; sortOrder?: number },
): Promise<CategoryRecordRow | null> => {
  const result = await client.query<CategoryRecordRow>(
    `UPDATE knowledge_categories
     SET name = COALESCE($2, name), sort_order = COALESCE($3, sort_order), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${CATEGORY_COLUMNS}`,
    [categoryId, changes.name ?? null, changes.sortOrder ?? null],
  );
  return result.rows[0] ?? null;
};

// Documents keep the id but stop showing the category (joins skip deleted).
export const softDeleteCategory = async (
  client: PoolClient,
  categoryId: string,
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE knowledge_categories SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [categoryId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const findCategoryBrandId = async (
  client: PoolClient,
  categoryId: string,
): Promise<string | null> => {
  const result = await client.query<{ brand_id: string }>(
    `SELECT manufacturer_id AS brand_id FROM knowledge_categories
     WHERE id = $1 AND deleted_at IS NULL`,
    [categoryId],
  );
  return result.rows[0]?.brand_id ?? null;
};

export const countLiveBrands = async (
  client: PoolClient,
  brandIds: string[],
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM machine_manufacturers
     WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [brandIds],
  );
  return Number(result.rows[0].count);
};

// See set_knowledge_item_classification() (migration 0102).
export const setItemClassification = async (
  client: PoolClient,
  change: { itemId: string; brandId: string | null; categoryId: string | null },
): Promise<boolean> => {
  const result = await client.query<{ updated: boolean }>(
    'SELECT set_knowledge_item_classification($1, $2, $3) AS updated',
    [change.itemId, change.brandId, change.categoryId],
  );
  return result.rows[0]?.updated ?? false;
};

// Every brand, flagged with whether `brandIds` includes it.
export const listBrandAccess = async (
  client: PoolClient,
  brandIds: string[],
): Promise<BrandAccessRow[]> => {
  const result = await client.query<BrandAccessRow>(
    `SELECT id, name, id = ANY($1::uuid[]) AS has_access
     FROM machine_manufacturers WHERE deleted_at IS NULL ORDER BY name`,
    [brandIds],
  );
  return result.rows;
};

// See set_tenant_brand_access() (migration 0102); false = no such tenant.
export const setTenantBrandAccess = async (
  client: PoolClient,
  change: {
    tenantId: string;
    restricted: boolean;
    brandIds: string[];
    userId: string;
  },
): Promise<boolean> => {
  const result = await client.query<{ updated: boolean }>(
    'SELECT set_tenant_brand_access($1, $2, $3, $4) AS updated',
    [change.tenantId, change.restricted, change.brandIds, change.userId],
  );
  return result.rows[0]?.updated ?? false;
};
