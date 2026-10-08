import { StorageService } from '../storage/storage.service';
import { toMachinePhoto } from './machinePhotoMapper';
import { HistoryEntryRow, MachineDetailRow, MachineRow } from './types/machineHistoryRows';
import { HistoryEntry, MachineDetail, MachineSummary } from './types/machineHistoryResponse';

export const toPersonName = (firstName: string | null, lastName: string | null): string =>
  `${firstName ?? ''} ${lastName ?? ''}`.trim();

export const toMachineSummary = (row: MachineRow): MachineSummary => ({
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

export const toMachineDetail = (row: MachineDetailRow): MachineDetail => ({
  ...toMachineSummary(row),
  hoursReadAt: row.operating_hours_read_at ? new Date(row.operating_hours_read_at).toISOString() : null,
  owner: row.owner_id
    ? { id: row.owner_id, name: toPersonName(row.owner_first_name, row.owner_last_name), avatarUrl: row.owner_avatar_url }
    : null,
  openCaseCount: row.open_case_count,
});

export const toHistoryEntry = async (storageService: StorageService, row: HistoryEntryRow): Promise<HistoryEntry> => ({
  id: row.id,
  entryType: row.entry_type,
  description: row.description,
  isAmendment: row.is_amendment,
  createdAt: row.created_at.toISOString(),
  author: row.author_id ? { id: row.author_id, name: toPersonName(row.author_first_name, row.author_last_name) } : null,
  component:
    row.component_id && row.component_name
      ? { id: row.component_id, name: row.component_name, systemName: row.system_name ?? '' }
      : null,
  operatingHours: row.operating_hours,
  downtimeHours: row.downtime_hours === null ? null : Number(row.downtime_hours),
  photos: await Promise.all(row.photos.map((photo) => toMachinePhoto(storageService, photo))),
});
