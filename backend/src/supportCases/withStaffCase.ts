import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { requireSupportCase } from './requireSupportCase';
import { StaffCaseAccess } from './caseAccess.service';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';

// Runs staff work under the case's own organisation (its RLS and audit
// log). The case is re-read inside the transaction, so an assignee who
// was just reassigned away can't keep working on it.
export const withStaffCase = <T>(
  databaseService: DatabaseService,
  actor: AuthenticatedUser,
  access: StaffCaseAccess,
  work: (client: PoolClient, supportCase: SupportCaseRow) => Promise<T>,
): Promise<T> =>
  databaseService.withActor(
    { tenantId: access.caseTenantId, userId: actor.userId },
    async (client) => {
      const supportCase = await requireSupportCase(
        client,
        access.caseTenantId,
        Number(access.supportCase.case_number),
      );
      if (
        access.role === 'assignee' &&
        supportCase.assignee_id !== actor.userId
      ) {
        throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
      }
      return work(client, supportCase);
    },
  );
