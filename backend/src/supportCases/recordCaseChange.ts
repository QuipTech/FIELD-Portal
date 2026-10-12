import { PoolClient } from 'pg';
import { insertAuditLog } from '../auth/auth.repository';
import { insertCaseEvent, NewCaseEvent } from './caseEvents.repository';
import { CaseEventRow } from './types/supportCaseRows';

export const SUPPORT_CASE_AUDIT_ENTITY = 'support_case';

export interface CaseChange {
  // The case's organisation: the audit entry lands in its audit log.
  tenantId: string;
  caseId: string;
  caseNumber: number;
  actorId: string;
  action: 'create' | 'update';
  events: Omit<NewCaseEvent, 'tenantId' | 'caseId' | 'actorId'>[];
}

// Every change to a case writes its thread line(s) and one audit entry,
// inside the caller's transaction, so neither is saved without the other.
export const recordCaseChange = async (
  client: PoolClient,
  change: CaseChange,
): Promise<CaseEventRow[]> => {
  if (!change.events.length) return [];
  const rows: CaseEventRow[] = [];
  for (const event of change.events) {
    rows.push(
      await insertCaseEvent(client, {
        ...event,
        tenantId: change.tenantId,
        caseId: change.caseId,
        actorId: change.actorId,
      }),
    );
  }
  await insertAuditLog(client, {
    tenantId: change.tenantId,
    userId: change.actorId,
    action: change.action,
    entityType: SUPPORT_CASE_AUDIT_ENTITY,
    entityId: change.caseId,
    metadata: {
      caseNumber: change.caseNumber,
      changes: change.events.map(({ type, fromValue, toValue }) => ({
        type,
        from: fromValue ?? null,
        to: toValue ?? null,
      })),
    },
  });
  return rows;
};
