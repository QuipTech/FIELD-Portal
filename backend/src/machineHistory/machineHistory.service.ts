import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { assertComponentOnMachine } from './assertComponentOnMachine';
import { captureSnapshot } from '../machineConfiguration/snapshots.repository';
import * as machineHistoryRepository from './machineHistory.repository';
import * as historyEntriesRepository from './historyEntries.repository';
import { signMachinePhoto } from '../machineFleet/machinePhotoUrl';
import { listAssignedTechnicians } from '../machineAssignments/machineAssignments.repository';
import { toAssignedTechnician } from '../machineAssignments/assignedTechnicianMapper';
import {
  toHistoryEntry,
  toMachineDetail,
  toPersonName,
} from './machineHistoryMapper';
import { CreateHistoryEntryDto } from './dto/createHistoryEntryDto';
import { ListHistoryQueryDto } from './dto/listHistoryQueryDto';
import { ACCESSIBLE_MACHINES } from '../machineSharing/access/machineScope';
import {
  assertMachineAccessible,
  MACHINE_NOT_FOUND_MESSAGE,
} from './assertMachineAccessible';
import { HistoryEntry, MachineDetail } from './types/machineHistoryResponse';

@Injectable()
export class MachineHistoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getMachine = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineDetail> =>
    this.databaseService.withActor(actor, async (client) => {
      const row = await machineHistoryRepository.findMachineDetail(
        client,
        actor.tenantId,
        machineId,
        ACCESSIBLE_MACHINES,
      );
      if (!row) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
      // A shared machine's people (owner, technicians) aren't the reader's to see.
      const technicians = row.is_shared
        ? []
        : await listAssignedTechnicians(client, actor.tenantId, machineId);
      return {
        ...toMachineDetail(row),
        photoUrl: await signMachinePhoto(
          this.storageService,
          row.photo_storage_key,
        ),
        assignedTechnicians: technicians.map(toAssignedTechnician),
      };
    });

  listHistory = async (
    actor: AuthenticatedUser,
    machineId: string,
    query: ListHistoryQueryDto = {},
  ): Promise<HistoryEntry[]> => {
    const rows = await this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(client, machineId);
      return historyEntriesRepository.listHistoryEntries(
        client,
        access.tenantId,
        machineId,
        {
          entryType: query.type,
          from: query.from,
          to: query.to,
          authorId: query.author,
          limit: query.limit,
          offset: query.offset,
        },
      );
    });
    return Promise.all(
      rows.map((row) => toHistoryEntry(this.storageService, row)),
    );
  };

  listAuthors = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<{ id: string; name: string }[]> =>
    this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(client, machineId);
      const rows = await historyEntriesRepository.listHistoryAuthors(
        client,
        access.tenantId,
        machineId,
      );
      return rows.map((row) => ({
        id: row.id,
        name: toPersonName(row.first_name, row.last_name),
      }));
    });

  // Also records the hour-meter reading on the machine, and takes a
  // "component_replaced" snapshot for a repair that swapped a component.
  // On a shared machine ('contribute') the entry belongs to the owning
  // organisation, by the caller; the machine record and its configuration
  // stay the owner's to change, so neither is touched.
  createEntry = async (
    actor: AuthenticatedUser,
    machineId: string,
    dto: CreateHistoryEntryDto,
  ): Promise<HistoryEntry> => {
    const row = await this.databaseService.withActor(actor, async (client) => {
      const { access } = await assertMachineAccessible(
        client,
        machineId,
        'contribute',
      );
      await assertComponentOnMachine(client, {
        tenantId: access.tenantId,
        machineId,
        componentId: dto.componentId,
      });
      const entryId = await historyEntriesRepository.insertHistoryEntry(
        client,
        {
          tenantId: access.tenantId,
          machineId,
          userId: actor.userId,
          entryType: dto.entryType,
          description: dto.description,
          componentId: dto.componentId ?? null,
          operatingHours: dto.operatingHours ?? null,
          downtimeHours: dto.downtimeHours ?? null,
        },
      );
      if (dto.operatingHours !== undefined && !access.isShared) {
        await historyEntriesRepository.recordOperatingHours(client, {
          tenantId: actor.tenantId,
          machineId,
          operatingHours: dto.operatingHours,
        });
      }
      if (
        dto.entryType === 'repair' &&
        dto.componentId &&
        dto.componentReplaced &&
        !access.isShared
      ) {
        await captureSnapshot(client, {
          machineId,
          takenBy: actor.userId,
          trigger: 'component_replaced',
        });
      }
      await authRepository.insertAuditLog(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'create',
        entityType: 'technical_history_entry',
        entityId: entryId,
        metadata: {
          machineId,
          entryType: dto.entryType,
          componentId: dto.componentId ?? null,
          ...(access.isShared ? { owningOrganisationId: access.tenantId } : {}),
        },
      });
      const [created] = await historyEntriesRepository.listHistoryEntries(
        client,
        access.tenantId,
        machineId,
        { entryId },
      );
      return created;
    });
    return toHistoryEntry(this.storageService, row);
  };
}
