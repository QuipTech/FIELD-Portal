import { ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { findUserAccess, UserAccess } from '../auth/userAccess.repository';
import { KnowledgeDocumentRow } from '../knowledge/types/knowledgeDocumentRows';

const SUBMIT_PERMISSION = 'knowledge.submit';

export const loadActorAccess = (
  databaseService: DatabaseService,
  actor: AuthenticatedUser,
): Promise<UserAccess> =>
  databaseService.withTenant(actor.tenantId, (client) =>
    findUserAccess(client, actor.userId),
  );

// Shared-library documents (tenant_id NULL) belong to QuipTech: Owner
// only. An organisation's own documents: anyone there who may submit
// knowledge. (Visibility — own org + shared — is checked when loading.)
export const assertCanManageDocument = (
  row: KnowledgeDocumentRow,
  access: UserAccess,
): void => {
  if (row.tenant_id === null) {
    if (!access.roles.includes(OWNER_ROLE_NAME)) {
      throw new ForbiddenException(
        'Only QuipTech administrators can change shared-library documents.',
      );
    }
    return;
  }
  if (!access.permissions.includes(SUBMIT_PERMISSION)) {
    throw new ForbiddenException("Your role doesn't allow managing documents.");
  }
};

// Approving/rejecting bulletins and policies is an admin (Owner) decision.
export const assertCanReview = (access: UserAccess): void => {
  if (!access.roles.includes(OWNER_ROLE_NAME)) {
    throw new ForbiddenException(
      'Only QuipTech administrators can review documents.',
    );
  }
};
