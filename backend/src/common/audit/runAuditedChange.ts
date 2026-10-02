import { ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import * as authRepository from '../../auth/auth.repository';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';

const UNIQUE_VIOLATION_CODE = '23505';

export interface AuditEntry {
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}

export interface AuditedChange<T> {
  result: T;
  audit: AuditEntry;
}

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === UNIQUE_VIOLATION_CODE;

// For audited changes: each is audited under the actor's own
// organisation, and the change and its audit entry share one transaction,
// so neither is ever saved without the other. app.user_id is set for the
// transaction so database triggers (e.g. machine status history) can
// record who made the change. A unique violation surfaces as a 409 with
// `conflictMessage`.
export const runAuditedChange = async <T>(
  databaseService: DatabaseService,
  actor: AuthenticatedUser,
  conflictMessage: string,
  applyChange: (client: PoolClient) => Promise<AuditedChange<T>>,
): Promise<T> => {
  try {
    return await databaseService.withActor(actor, async (client) => {
      const { result, audit } = await applyChange(client);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId,
        metadata: audit.metadata,
      });
      return result;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictException(conflictMessage);
    throw error;
  }
};
