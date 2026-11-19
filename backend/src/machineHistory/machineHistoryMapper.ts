import { toLifecycleState } from '../machineLifecycle/lifecycleTransitions';
import { StorageService } from '../storage/storage.service';
import { toMachinePhoto } from './machinePhotoMapper';
import { toMachineDocumentFile } from './machineDocumentMapper';
import {
  HistoryEntryRow,
  MachineDetailRow,
  MachineRow,
} from './types/machineHistoryRows';
import {
  HistoryEntry,
  MachineDetail,
  MachineSummary,
  RemoteSessionSummary,
} from './types/machineHistoryResponse';

export const toPersonName = (
  firstName: string | null,
  lastName: string | null,
): string => `${firstName ?? ''} ${lastName ?? ''}`.trim();

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

// photoUrl and assignedTechnicians are filled in by the service.
export const toMachineDetail = (
  row: MachineDetailRow,
): Omit<MachineDetail, 'photoUrl' | 'assignedTechnicians'> => ({
  ...toMachineSummary(row),
  modelId: row.model_id,
  plantId: row.asset_number || null,
  hoursReadAt: row.operating_hours_read_at
    ? new Date(row.operating_hours_read_at).toISOString()
    : null,
  lifecycleState: toLifecycleState(row.lifecycle_state),
  owner: row.owner_id
    ? {
        id: row.owner_id,
        name: toPersonName(row.owner_first_name, row.owner_last_name),
        avatarUrl: row.owner_avatar_url,
      }
    : null,
  openCaseCount: row.open_case_count,
  groups: row.groups,
  owningOrganisationName: row.owning_organisation_name,
  isShared: row.is_shared,
  accessLevel: row.access_level,
});

export const toHistoryEntry = async (
  storageService: StorageService,
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
        name: toPersonName(row.author_first_name, row.author_last_name),
      }
    : null,
  authorOrganisationName: row.author_organisation_name,
  component:
    row.component_id && row.component_name
      ? {
          id: row.component_id,
          name: row.component_name,
          systemName: row.system_name ?? '',
        }
      : null,
  operatingHours: row.operating_hours,
  downtimeHours:
    row.downtime_hours === null ? null : Number(row.downtime_hours),
  photos: await Promise.all(
    row.photos.map((photo) => toMachinePhoto(storageService, photo)),
  ),
  documents: await Promise.all(
    row.documents.map((document) =>
      toMachineDocumentFile(storageService, document),
    ),
  ),
  remoteSession: row.remote_session
    ? toRemoteSessionSummary(row.remote_session)
    : null,
});

const toRemoteSessionSummary = (
  session: NonNullable<HistoryEntryRow['remote_session']>,
): RemoteSessionSummary => {
  const started = session.started_at ? Date.parse(session.started_at) : null;
  const ended = session.ended_at ? Date.parse(session.ended_at) : null;
  return {
    id: session.id,
    requesterName: session.requester_name,
    startedAt: started === null ? null : new Date(started).toISOString(),
    endedAt: ended === null ? null : new Date(ended).toISOString(),
    durationSeconds:
      started !== null && ended !== null
        ? Math.max(0, Math.floor((ended - started) / 1000))
        : null,
    endReason: session.end_reason,
    recordingStatus: session.recording_status,
    transcriptStatus: session.transcript_status,
  };
};
