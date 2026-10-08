import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { assertMachineInTenant } from '../machineHistory/machineHistory.service';
import * as snapshotsRepository from './snapshots.repository';
import { toSnapshot } from './machineConfigurationMapper';
import { diffSnapshotItems } from './snapshotDiff';
import { toDiffCsv, toDiffPdf } from './snapshotDiffExport';
import { SnapshotDiff } from './types/machineConfigurationResponse';
import { SNAPSHOT_NOT_FOUND_MESSAGE } from './machineConfiguration.service';

export type DiffExportFormat = 'csv' | 'pdf';

interface DiffTarget {
  machineId: string;
  fromId: string;
  toId: string;
}

export interface DiffExportFile {
  body: string | Uint8Array;
  contentType: string;
  fileName: string;
}

const requireSnapshot = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; snapshotId: string },
) => {
  const row = await snapshotsRepository.findSnapshot(client, params);
  if (!row) throw new NotFoundException(SNAPSHOT_NOT_FOUND_MESSAGE);
  return row;
};

// Compares two of a machine's snapshots, always older → newer, and
// exports the comparison as CSV or PDF.
@Injectable()
export class SnapshotDiffService {
  constructor(private readonly databaseService: DatabaseService) {}

  getDiff = (actor: AuthenticatedUser, target: DiffTarget): Promise<SnapshotDiff> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, target.machineId);
      const scope = { tenantId: actor.tenantId, machineId: target.machineId };
      const [first, second] = await Promise.all([
        requireSnapshot(client, { ...scope, snapshotId: target.fromId }),
        requireSnapshot(client, { ...scope, snapshotId: target.toId }),
      ]);
      const [older, newer] = first.taken_at <= second.taken_at ? [first, second] : [second, first];
      const [olderItems, newerItems] = await Promise.all([
        snapshotsRepository.listSnapshotItems(client, actor.tenantId, older.id),
        snapshotsRepository.listSnapshotItems(client, actor.tenantId, newer.id),
      ]);
      return { from: toSnapshot(older), to: toSnapshot(newer), ...diffSnapshotItems(olderItems, newerItems) };
    });

  exportDiff = async (
    actor: AuthenticatedUser,
    target: DiffTarget,
    format: DiffExportFormat,
  ): Promise<DiffExportFile> => {
    const diff = await this.getDiff(actor, target);
    const machineLabel = await this.databaseService.withTenant(actor.tenantId, async (client) => {
      const machine = await assertMachineInTenant(client, actor.tenantId, target.machineId);
      return `${machine.manufacturer_name} ${machine.model_name} · ${machine.label}`;
    });
    const fileName = `config-diff-${diff.from.takenAt.slice(0, 10)}-to-${diff.to.takenAt.slice(0, 10)}.${format}`;
    return format === 'csv'
      ? { body: toDiffCsv(diff), contentType: 'text/csv; charset=utf-8', fileName }
      : { body: await toDiffPdf(diff, machineLabel), contentType: 'application/pdf', fileName };
  };
}
