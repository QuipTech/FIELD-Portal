import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';

// Read queries for brand and category lists. The access check is the same
// knowledge_has_brand_access predicate getAccessibleBrandIds uses, run inside
// the same statement: the database is a long round trip away, so a separate
// access query would roughly double the time these lists take.

type Client = Pick<PoolClient, 'query'>;

const categoryColumns = `c.id,c.brand_id AS "brandId",c.parent_id AS "parentId",c.name,c.slug,c.sort_order AS "sortOrder"`;

export const selectAccessibleBrands = async (
  client: Client,
  actor: AuthenticatedUser,
) =>
  (
    await client.query(
      `SELECT b.id,b.name,b.slug,b.description,b.is_active AS "isActive",b.sort_order AS "sortOrder",
        b.logo_file_id AS "logoFileId",b.created_at AS "createdAt",b.updated_at AS "updatedAt",
        b.logo_storage_key,
        (SELECT count(*)::int FROM documents d JOIN knowledge_items ki ON ki.id=d.knowledge_item_id
         WHERE d.brand_id=b.id AND knowledge_can_read_document(d.id,$1,$2)
         AND d.live_version_id IS NOT NULL AND ki.status NOT IN ('archived','withdrawn')) AS "documentCount"
       FROM knowledge_brands b WHERE knowledge_has_brand_access(b.id,$1,$2)
       ORDER BY b.sort_order,b.name`,
      [actor.tenantId, actor.userId],
    )
  ).rows;

// `null` when the brand doesn't exist or isn't accessible (the caller 404s).
export const selectBrandCategories = async (
  client: Client,
  actor: AuthenticatedUser,
  brandId: string,
) => {
  const result = await client.query<{ allowed: boolean; categories: unknown[] }>(
    `SELECT knowledge_has_brand_access($1,$2,$3) AS allowed,
       COALESCE((SELECT json_agg(c ORDER BY c."sortOrder",c.name) FROM
         (SELECT ${categoryColumns} FROM knowledge_categories c WHERE c.brand_id=$1) c),'[]'::json) AS categories`,
    [brandId, actor.tenantId, actor.userId],
  );
  return result.rows[0]?.allowed ? result.rows[0].categories : null;
};

// Every category of every brand the user can access, in one request.
export const selectAccessibleCategories = async (
  client: Client,
  actor: AuthenticatedUser,
) =>
  (
    await client.query(
      `SELECT ${categoryColumns} FROM knowledge_categories c
       WHERE knowledge_has_brand_access(c.brand_id,$1,$2)
       ORDER BY c.brand_id,c.sort_order,c.name`,
      [actor.tenantId, actor.userId],
    )
  ).rows;
