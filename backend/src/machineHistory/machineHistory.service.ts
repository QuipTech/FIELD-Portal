import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { componentBelongsToMachine } from '../machineConfiguration/machineComponents.repository';
import { captureSnapshot } from '../machineConfiguration/snapshots.repository';
import * as machineHistoryRepository from './machineHistory.repository';
import * as historyEntriesRepository from './historyEntries.repository';
import { toHistoryEntry, toMachineDetail, toPersonName } from './machineHistoryMapper';
import { CreateHistoryEntryDto } from './dto/createHistoryEntryDto';
import { ListHistoryQueryDto } from './dto/listHistoryQueryDto';
import { MachineRow } from './types/machineHistoryRows';
import { HistoryEntry, MachineDetail } from './types/machineHistoryResponse';

export const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const COMPONENT_NOT_FOUND_MESSAGE = "That component isn't installed on this machine.";

// Throws 404 unless the machine exists in the caller's own organisation.
export const assertMachineInTenant = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineRow> => {
  const machine = await machineHistoryRepository.findMachine(client, tenantId, machineId);
  if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
  return machine;
};

@Injectable()
export class MachineHistoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getMachine = (actor: AuthenticatedUser, machineId: string): Promise<MachineDetail> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const row = await machineHistoryRepository.findMachineDetail(client, actor.tenantId, machineId);
      if (!row) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      return toMachineDetail(row);
    });

  listHistory = async (
    actor: AuthenticatedUser,
    machineId: string,
    query: ListHistoryQueryDto = {},
  ): Promise<HistoryEntry[]> => {
    const rows = await this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      return historyEntriesRepository.listHistoryEntries(client, actor.tenantId, machineId, {
        entryType: query.type,
        from: query.from,
        to: query.to,
        authorId: query.author,
        limit: query.limit,
        offset: query.offset,
      });
    });
    return Promise.all(rows.map((row) => toHistoryEntry(this.storageService, row)));
  };

  listAuthors = (actor: AuthenticatedUser, machineId: string): Promise<{ id: string; name: string }[]> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      const rows = await historyEntriesRepository.listHistoryAuthors(client, actor.tenantId, machineId);
      return rows.map((row) => ({ id: row.id, name: toPersonName(row.first_name, row.last_name) }));
    });

  // Also records the hour-meter reading on the machine, and takes a
  // "component_replaced" snapshot for a repair that swapped a component.
  createEntry = async (actor: AuthenticatedUser, machineId: string, dto: CreateHistoryEntryDto): Promise<HistoryEntry> => {
    const row = await this.databaseService.withTenant(actor.tenantId, async (client) => {
      await assertMachineInTenant(client, actor.tenantId, machineId);
      await this.assertComponentOnMachine(client, actor.tenantId, machineId, dto.componentId);
      const entryId = await historyEntriesRepository.insertHistoryEntry(client, {
        tenantId: actor.tenantId,
        machineId,
        userId: actor.userId,
        entryType: dto.entryType,
        description: dto.description,
        componentId: dto.componentId ?? null,
        operatingHours: dto.operatingHours ?? null,
        downtimeHours: dto.downtimeHours ?? null,
      });
      if (dto.operatingHours !== undefined) {
        await historyEntriesRepository.recordOperatingHours(client, {
          tenantId: actor.tenantId,
          machineId,
          operatingHours: dto.operatingHours,
        });
      }
      if (dto.entryType === 'repair' && dto.componentId && dto.componentReplaced) {
        await captureSnapshot(client, { machineId, takenBy: actor.userId, trigger: 'component_replaced' });
      }
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'technical_history_entry',
        entityId: entryId,
        metadata: { machineId, entryType: dto.entryType, componentId: dto.componentId ?? null },
      });
      const [created] = await historyEntriesRepository.listHistoryEntries(client, actor.tenantId, machineId, { entryId });
      return created;
    });
    return toHistoryEntry(this.storageService, row);
  };

  private assertComponentOnMachine = async (
    client: PoolClient,
    tenantId: string,
    machineId: string,
    componentId: string | undefined,
  ): Promise<void> => {
    if (!componentId) return;
    const isOnMachine = await componentBelongsToMachine(client, { tenantId, machineId, componentId });
    if (!isOnMachine) throw new BadRequestException(COMPONENT_NOT_FOUND_MESSAGE);
  };
}
