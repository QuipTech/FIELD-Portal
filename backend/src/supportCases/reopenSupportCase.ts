import { ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as casesRepository from './supportCases.repository';
import { requireVisibleSupportCase } from './requireSupportCase';
import { recordCaseChange } from './recordCaseChange';
import { canReopenCase, resolveReopenedStatus } from './caseAccessPolicy';
import { CaseStatus } from './types/supportCaseResponse';

const REOPEN_REFUSED_MESSAGE =
  'Only a case resolved in the last 7 days can be reopened.';

// Within 7 days of being resolved, anyone in the organisation who can see
// the case reopens it: back to its assignee (open), or to the queue (new).
// Runs in the caller's transaction; the caller announces the change.
export const reopenSupportCase = async (
  client: PoolClient,
  actor: AuthenticatedUser,
  caseNumber: number,
) => {
  const existing = await requireVisibleSupportCase(client, actor, caseNumber);
  if (
    !canReopenCase(
      existing.status as CaseStatus,
      existing.resolved_at,
      new Date(),
    )
  ) {
    throw new ConflictException(REOPEN_REFUSED_MESSAGE);
  }
  const status = resolveReopenedStatus(existing.assignee_id);
  await casesRepository.updateCase(client, {
    tenantId: actor.tenantId,
    caseId: existing.id,
    patch: { status },
  });
  const events = await recordCaseChange(client, {
    tenantId: actor.tenantId,
    caseId: existing.id,
    caseNumber,
    actorId: actor.userId,
    action: 'update',
    events: [{ type: 'reopened', fromValue: existing.status, toValue: status }],
  });
  const row = await requireVisibleSupportCase(client, actor, caseNumber);
  return { row, events };
};
