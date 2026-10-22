import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';
import { findUserPermissionCodes } from '../../auth/userAccess.repository';
import { KNOWLEDGE_ADMIN_PERMISSION, KnowledgeAccess } from './knowledgeAccess';

const findPlanBrandIds = async (
  client: PoolClient,
  tenantId: string,
): Promise<string[] | null> => {
  const result = await client.query<{
    restricted: boolean;
    brand_ids: string[];
  }>(
    `SELECT t.knowledge_brands_restricted AS restricted,
            COALESCE((SELECT array_agg(a.manufacturer_id) FROM tenant_brand_access a
                      WHERE a.tenant_id = t.id), '{}') AS brand_ids
     FROM tenants t WHERE t.id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  return row?.restricted ? row.brand_ids : null;
};

// Read per request, like the role guards, so a plan or role change applies
// straight away.
@Injectable()
export class KnowledgeAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  resolve = (actor: AuthenticatedUser): Promise<KnowledgeAccess> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const permissions = await findUserPermissionCodes(client, actor.userId);
      return {
        tenantId: actor.tenantId,
        userId: actor.userId,
        isAdmin: permissions.includes(KNOWLEDGE_ADMIN_PERMISSION),
        isPlatform: permissions.includes(PLATFORM_PERMISSION_CODE),
        brandIds: await findPlanBrandIds(client, actor.tenantId),
      };
    });
}
