import { PoolClient } from 'pg';

export interface BrandRow {
  id: string;
  name: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  brand_id: string;
  brand_name: string;
}

// Run inside withActor(caller). A brand the caller can't read (inactive,
// for anyone but platform admins) is not found.

export const findBrand = async (
  client: PoolClient,
  tenantId: string,
  brandId: string,
): Promise<BrandRow | null> => {
  const result = await client.query<BrandRow>(
    `SELECT id, name FROM knowledge_brands
     WHERE id = $1 AND knowledge_has_brand_access(id, $2)`,
    [brandId, tenantId],
  );
  return result.rows[0] ?? null;
};

export const findCategory = async (
  client: PoolClient,
  tenantId: string,
  categoryId: string,
): Promise<CategoryRow | null> => {
  const result = await client.query<CategoryRow>(
    `SELECT kc.id, kc.name, kc.parent_id, kb.id AS brand_id, kb.name AS brand_name
     FROM knowledge_categories kc
     JOIN knowledge_brands kb ON kb.id = kc.brand_id
     WHERE kc.id = $1 AND knowledge_has_brand_access(kb.id, $2)`,
    [categoryId, tenantId],
  );
  return result.rows[0] ?? null;
};
