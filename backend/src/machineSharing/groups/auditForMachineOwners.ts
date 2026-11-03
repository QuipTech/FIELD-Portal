import { PoolClient } from 'pg';
import { insertAuditLog } from '../../auth/auth.repository';
import { AuditEntry } from '../../common/audit/runAuditedChange';
import { runInTenantContext } from '../../database/runInTenantContext';

// Owning organisations see their machines being shared: each gets the
// entry in its own audit log too (the platform administrator's goes in
// theirs, through runAuditedChange), written under its own RLS context
// inside the same transaction.
export const auditForMachineOwners = async (
  client: PoolClient,
  actor: { tenantId: string; userId: string },
  ownerTenantIds: string[],
  entry: AuditEntry,
): Promise<void> => {
  for (const tenantId of new Set(ownerTenantIds)) {
    if (tenantId === actor.tenantId) continue;
    await runInTenantContext(
      client,
      { tenantId, returnToTenantId: actor.tenantId },
      () =>
        insertAuditLog(client, {
          ...entry,
          tenantId,
          userId: actor.userId,
        }),
    );
  }
};
