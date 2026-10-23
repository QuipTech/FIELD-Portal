import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { assertMachineInTenant } from '../machineHistory/machineHistory.service';
import { listHistoryEntries } from '../machineHistory/historyEntries.repository';
import { toHistoryEntry } from '../machineHistory/machineHistoryMapper';
import * as machineComponentsRepository from './machineComponents.repository';
import { toMachineComponent } from './machineConfigurationMapper';
import { MachineComponentDetail } from './types/machineConfigurationResponse';

export const COMPONENT_NOT_FOUND_MESSAGE = 'Component not found on this machine.';

// One installed component with the history logged against it, for the
// mobile app's component detail screen.
@Injectable()
export class ComponentDetailService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getComponent = async (
    actor: AuthenticatedUser,
    target: { machineId: string; componentId: string },
  ): Promise<MachineComponentDetail> => {
    const { row, historyRows } = await this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, target.machineId);
      const [componentRow] = await machineComponentsRepository.listComponents(client, {
        tenantId: actor.tenantId,
        machineId: target.machineId,
        systemId: null,
        componentId: target.componentId,
      });
      if (!componentRow) throw new NotFoundException(COMPONENT_NOT_FOUND_MESSAGE);
      const entries = await listHistoryEntries(client, actor.tenantId, target.machineId, {
        componentId: target.componentId,
      });
      return { row: componentRow, historyRows: entries };
    });
    return {
      ...toMachineComponent(row),
      history: await Promise.all(historyRows.map((entry) => toHistoryEntry(this.storageService, entry))),
    };
  };
}
