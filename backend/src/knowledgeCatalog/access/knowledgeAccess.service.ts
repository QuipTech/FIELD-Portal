import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PLATFORM_PERMISSION_CODE } from '../../auth/systemRoleNames';
import { findUserPermissionCodes } from '../../auth/userAccess.repository';
import { KNOWLEDGE_ADMIN_PERMISSION, KnowledgeAccess } from './knowledgeAccess';

// Read per request, like the role guards, so a role change applies
// straight away.
@Injectable()
export class KnowledgeAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  resolve = (actor: AuthenticatedUser): Promise<KnowledgeAccess> =>
    this.databaseService.withActor(actor, async (client) => {
      const permissions = await findUserPermissionCodes(client, actor.userId);
      return {
        tenantId: actor.tenantId,
        userId: actor.userId,
        isAdmin: permissions.includes(KNOWLEDGE_ADMIN_PERMISSION),
        isPlatform: permissions.includes(PLATFORM_PERMISSION_CODE),
      };
    });
}
