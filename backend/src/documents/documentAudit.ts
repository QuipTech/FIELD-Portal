import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';

// A document change made by a signed-in user, audited under their own
// organisation (shared-library documents have none of their own).
export const auditDocumentChange = (
  databaseService: DatabaseService,
  actor: AuthenticatedUser,
  change: {
    itemId: string;
    action: 'create' | 'update' | 'delete';
    metadata: Record<string, unknown>;
  },
): Promise<void> =>
  databaseService.withTenant(actor.tenantId, (client) =>
    authRepository.insertAuditLog(client, {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: change.action,
      entityType: 'knowledge_item',
      entityId: change.itemId,
      metadata: change.metadata,
    }),
  );
