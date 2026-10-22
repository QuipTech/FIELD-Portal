import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { assertMachineInTenant } from '../machineHistory/machineHistory.service';
import * as snapshotsRepository from './snapshots.repository';
import { toSnapshot } from './machineConfigurationMapper';
import { requireSnapshot } from './snapshotDiff.service';
import { SnapshotRestore } from './types/machineConfigurationResponse';

// Puts a machine's recorded configuration back to a snapshot (e.g. a known
// good one): serials, firmware and software of the components it still
// has. The configuration being replaced is snapshotted first
// ('before_restore') and the result after ('restored'), so a restore can
// itself be compared or undone. Components aren't added or removed;
// those differences are reported instead.
@Injectable()
export class SnapshotRestoreService {
  constructor(private readonly databaseService: DatabaseService) {}

  restore = (
    actor: AuthenticatedUser,
    target: { machineId: string; snapshotId: string },
  ): Promise<SnapshotRestore> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      await assertMachineInTenant(client, actor.tenantId, target.machineId);
      const scope = { tenantId: actor.tenantId, ...target };
      const source = await requireSnapshot(client, scope);
      const before = await this.capture(
        client,
        actor,
        target.machineId,
        'before_restore',
      );
      const updatedComponents = await snapshotsRepository.restoreSnapshotValues(
        client,
        scope,
      );
      const unmatched = await snapshotsRepository.listUnmatchedComponents(
        client,
        scope,
      );
      const after = await this.capture(
        client,
        actor,
        target.machineId,
        'restored',
      );
      const toComponent = (row: snapshotsRepository.UnmatchedComponentRow) => ({
        systemName: row.system_name,
        componentName: row.component_name,
      });
      return {
        result: {
          restoredFrom: toSnapshot(source),
          before: toSnapshot(before),
          after: toSnapshot(after),
          updatedComponents,
          missingComponents: unmatched
            .filter((row) => row.side === 'missing')
            .map(toComponent),
          extraComponents: unmatched
            .filter((row) => row.side === 'extra')
            .map(toComponent),
        },
        audit: {
          action: 'update',
          entityType: 'configuration_snapshot',
          entityId: target.snapshotId,
          metadata: {
            machineId: target.machineId,
            restored: true,
            beforeSnapshotId: before.id,
            afterSnapshotId: after.id,
            updatedComponents,
          },
        },
      };
    });

  private capture = async (
    client: PoolClient,
    actor: AuthenticatedUser,
    machineId: string,
    trigger: 'before_restore' | 'restored',
  ) => {
    const snapshotId = await snapshotsRepository.captureSnapshot(client, {
      machineId,
      takenBy: actor.userId,
      trigger,
    });
    return (await snapshotsRepository.findSnapshot(client, {
      tenantId: actor.tenantId,
      machineId,
      snapshotId,
    }))!;
  };
}
