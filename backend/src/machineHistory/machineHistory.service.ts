import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import * as authRepository from '../auth/auth.repository';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import * as machineHistoryRepository from './machineHistory.repository';
import { toMachinePhoto } from './machinePhotoMapper';
import { CreateHistoryEntryDto } from './dto/createHistoryEntryDto';
import { HistoryEntryRow, MachineRow } from './types/machineHistoryRows';
import { HistoryEntry, MachineSummary } from './types/machineHistoryResponse';

export const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';

const toMachineSummary = (row: MachineRow): MachineSummary => ({
  id: row.id,
  serialNumber: row.serial_number,
  fleetNumber: row.fleet_number,
  label: row.label,
  site: row.site,
  operatingHours: row.operating_hours,
  manufacturer: row.manufacturer_name,
  model: row.model_name,
  status: row.status,
});

// Throws 404 unless the machine exists in the caller's own organisation.
export const assertMachineInTenant = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineRow> => {
  const machine = await machineHistoryRepository.findMachine(
    client,
    tenantId,
    machineId,
  );
  if (!machine) throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
  return machine;
};

@Injectable()
export class MachineHistoryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getMachine = (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<MachineSummary> =>
    this.databaseService.withTenant(actor.tenantId, async (client) =>
      toMachineSummary(
        await assertMachineInTenant(client, actor.tenantId, machineId),
      ),
    );

  listHistory = async (
    actor: AuthenticatedUser,
    machineId: string,
  ): Promise<HistoryEntry[]> => {
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        await assertMachineInTenant(client, actor.tenantId, machineId);
        return machineHistoryRepository.listHistoryEntries(
          client,
          actor.tenantId,
          machineId,
        );
      },
    );
    return Promise.all(rows.map(this.toHistoryEntry));
  };

  createEntry = async (
    actor: AuthenticatedUser,
    machineId: string,
    dto: CreateHistoryEntryDto,
  ): Promise<HistoryEntry> => {
    const entryId = await this.databaseService.withTenant(
      actor.tenantId,
      async (client) => {
        await assertMachineInTenant(client, actor.tenantId, machineId);
        const id = await machineHistoryRepository.insertHistoryEntry(client, {
          tenantId: actor.tenantId,
          machineId,
          userId: actor.userId,
          ...dto,
        });
        await authRepository.insertAuditLog(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'technical_history_entry',
          entityId: id,
          metadata: { machineId, entryType: dto.entryType },
        });
        return id;
      },
    );
    const entries = await this.listHistory(actor, machineId);
    return entries.find((entry) => entry.id === entryId)!;
  };

  private toHistoryEntry = async (
    row: HistoryEntryRow,
  ): Promise<HistoryEntry> => ({
    id: row.id,
    entryType: row.entry_type,
    description: row.description,
    isAmendment: row.is_amendment,
    createdAt: row.created_at.toISOString(),
    author: row.author_id
      ? {
          id: row.author_id,
          name: `${row.author_first_name ?? ''} ${row.author_last_name ?? ''}`.trim(),
        }
      : null,
    photos: await Promise.all(
      row.photos.map((photo) => toMachinePhoto(this.storageService, photo)),
    ),
  });
}
