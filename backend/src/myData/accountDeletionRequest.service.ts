import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as myDataRepository from './myData.repository';
import { DeletionRequestRow } from './myData.repository';

export interface DeletionRequestStatus {
  id: string;
  status: DeletionRequestRow['status'];
  requestedAt: string;
}

const toStatus = (row: DeletionRequestRow): DeletionRequestStatus => ({
  id: row.id,
  status: row.status,
  requestedAt: row.requested_at.toISOString(),
});

// "Request account deletion": records the request and writes it to the
// audit log for an admin to act on. Nothing is deleted here, and the
// organisation's CMDB/asset data is never part of a user's deletion.
@Injectable()
export class AccountDeletionRequestService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Asking twice returns the request already pending (and isn't re-audited).
  requestDeletion = async (
    actor: AuthenticatedUser,
  ): Promise<DeletionRequestStatus> => {
    const existing = await this.getPendingRequest(actor);
    if (existing) return existing;
    const row = await runAuditedChange(
      this.databaseService,
      actor,
      'A deletion request is already pending.',
      async (client) => {
        const created = await myDataRepository.insertDeletionRequest(
          client,
          actor.tenantId,
          actor.userId,
        );
        const audit = {
          action: 'create' as const,
          entityType: 'account_deletion_request',
          entityId: actor.userId,
          metadata: { name: actor.email, requestId: created.id },
        };
        return { result: created, audit };
      },
    );
    return toStatus(row);
  };

  getPendingRequest = async (
    actor: AuthenticatedUser,
  ): Promise<DeletionRequestStatus | null> => {
    const row = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        myDataRepository.findPendingDeletionRequest(client, actor.userId),
    );
    return row ? toStatus(row) : null;
  };
}
