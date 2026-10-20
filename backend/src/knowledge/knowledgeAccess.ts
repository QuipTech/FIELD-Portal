import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';

// SQL predicates knowledge_has_brand_access / knowledge_can_read_document are
// shared by queries and RLS. Always read brand state from the DB, never a JWT/cache.
export const getAccessibleBrandIds = async (
  database: DatabaseService,
  actor: AuthenticatedUser,
): Promise<string[]> => {
  const result = await database.withActor(actor, (client) =>
    client.query<{ id: string }>(
      'SELECT id FROM knowledge_brands WHERE knowledge_has_brand_access(id,$1,$2)',
      [actor.tenantId, actor.userId],
    ),
  );
  return result.rows.map((row) => row.id);
};

export const assertDocumentAccess = async (
  database: DatabaseService,
  actor: AuthenticatedUser,
  itemId: string,
) => {
  const result = await database.withActor(actor, (client) =>
    client.query<{ allowed: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM documents d WHERE d.knowledge_item_id=$1
       AND knowledge_can_read_document(d.id,$2,$3)) AS allowed`,
      [itemId, actor.tenantId, actor.userId],
    ),
  );
  if (!result.rows[0]?.allowed)
    throw new NotFoundException('Document not found.');
};

export const setUploadClassification = async (
  client: PoolClient,
  brandId: string,
  categoryId: string,
) => {
  await client.query(
    `SELECT set_config('app.knowledge_brand_id',$1,true),set_config('app.knowledge_category_id',$2,true)`,
    [brandId, categoryId],
  );
};

export const assertKnowledgeScope = async (
  database: DatabaseService,
  actor: AuthenticatedUser,
  scope: { documentId?: string; brandId?: string; categoryId?: string },
) => {
  if (scope.documentId)
    await assertDocumentAccess(database, actor, scope.documentId);
  if (
    scope.brandId &&
    !(await getAccessibleBrandIds(database, actor)).includes(scope.brandId)
  )
    throw new NotFoundException('Brand not found.');
  if (scope.categoryId) {
    const category = await database.withActor(actor, (client) =>
      client.query(
        'SELECT id FROM knowledge_categories WHERE id=$1 AND knowledge_has_brand_access(brand_id,$2,$3)',
        [scope.categoryId, actor.tenantId, actor.userId],
      ),
    );
    if (!category.rowCount) throw new NotFoundException('Category not found.');
  }
};
