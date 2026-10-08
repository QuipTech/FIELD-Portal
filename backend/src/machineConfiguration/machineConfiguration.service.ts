import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { assertMachineInTenant } from '../machineHistory/machineHistory.service';
import * as machineComponentsRepository from './machineComponents.repository';
import * as snapshotsRepository from './snapshots.repository';
import { toMachineComponent, toSnapshot } from './machineConfigurationMapper';
import {
  MachineComponent,
  MachineSystem,
  Snapshot,
} from './types/machineConfigurationResponse';

export const SNAPSHOT_NOT_FOUND_MESSAGE = 'Snapshot not found.';

// A machine's installed systems/components and its configuration
// snapshots, within the caller's own organisation.
@Injectable()
export class MachineConfigurationService {
  constructor(private readonly databaseService: DatabaseService) {}

  listSystems = (actor: AuthenticatedUser, machineId: string): Promise<MachineSystem[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      await machineComponentsRepository.seedInstalledConfiguration(client, machineId);
      return machineComponentsRepository.listSystems(client, actor.tenantId, machineId);
    });

  listComponents = (
    actor: AuthenticatedUser,
    machineId: string,
    systemId: string | null,
  ): Promise<MachineComponent[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      await machineComponentsRepository.seedInstalledConfiguration(client, machineId);
      const rows = await machineComponentsRepository.listComponents(client, {
        tenantId: actor.tenantId,
        machineId,
        systemId,
      });
      return rows.map(toMachineComponent);
    });

  listSnapshots = (actor: AuthenticatedUser, machineId: string): Promise<Snapshot[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      const rows = await snapshotsRepository.listSnapshots(client, actor.tenantId, machineId);
      return rows.map(toSnapshot);
    });

  // A technician's manual snapshot of the current configuration.
  takeSnapshot = (actor: AuthenticatedUser, machineId: string): Promise<Snapshot> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      const snapshotId = await snapshotsRepository.captureSnapshot(client, {
        machineId,
        takenBy: actor.userId,
        trigger: 'manual',
      });
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'configuration_snapshot',
        entityId: snapshotId,
        metadata: { machineId, trigger: 'manual' },
      });
      const row = await snapshotsRepository.findSnapshot(client, { tenantId: actor.tenantId, machineId, snapshotId });
      return toSnapshot(row!);
    });

  setKnownGood = (
    actor: AuthenticatedUser,
    target: { machineId: string; snapshotId: string },
    isKnownGood: boolean,
  ): Promise<Snapshot> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, target.machineId);
      const params = { tenantId: actor.tenantId, ...target };
      const isUpdated = await snapshotsRepository.setSnapshotKnownGood(client, { ...params, isKnownGood });
      if (!isUpdated) throw new NotFoundException(SNAPSHOT_NOT_FOUND_MESSAGE);
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'update',
        entityType: 'configuration_snapshot',
        entityId: target.snapshotId,
        metadata: { machineId: target.machineId, isKnownGood },
      });
      return toSnapshot((await snapshotsRepository.findSnapshot(client, params))!);
    });
}
