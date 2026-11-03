import { GroupActivityRow } from './machineGroups.repository';
import {
  GroupMachineRow,
  PlatformMachineRow,
} from './groupMachines.repository';
import { AssignmentRow } from './groupAssignments.repository';
import {
  GroupActivity,
  GroupAssignment,
  GroupMachine,
  MachineGroup,
  MachineGroupRow,
  PlatformMachine,
} from '../types/machineGroupTypes';

const toIso = (value: Date | string) => new Date(value).toISOString();

export const toPersonName = (
  firstName: string | null,
  lastName: string | null,
): string | null => `${firstName ?? ''} ${lastName ?? ''}`.trim() || null;

export const toMachineGroup = (row: MachineGroupRow): MachineGroup => ({
  id: row.id,
  name: row.name,
  colour: row.colour,
  description: row.description,
  machineCount: row.machine_count,
  organisationCount: row.organisation_count,
  userCount: row.user_count,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const toPlatformMachineFields = (row: PlatformMachineRow) => ({
  id: row.id,
  label: row.label,
  serialNumber: row.serial_number,
  model: row.model_name,
  manufacturer: row.manufacturer_name,
  status: row.status,
  lifecycleState: row.lifecycle_state,
  owningOrganisation: { id: row.tenant_id, name: row.organisation_name },
});

export const toGroupMachine = (row: GroupMachineRow): GroupMachine => ({
  ...toPlatformMachineFields(row),
  addedAt: toIso(row.added_at),
});

export const toPlatformMachine = (
  row: PlatformMachineRow & { registration_number: string | null },
): PlatformMachine => ({
  ...toPlatformMachineFields(row),
  registrationNumber: row.registration_number,
});

export const toGroupAssignment = (row: AssignmentRow): GroupAssignment => ({
  id: row.id,
  targetType: row.target_type,
  targetId: row.target_id,
  targetName: row.target_name,
  targetEmail: row.target_email,
  organisation: { id: row.organisation_id, name: row.organisation_name },
  accessLevel: row.access_level,
  grantedByName: row.granted_by_name,
  grantedAt: toIso(row.granted_at),
});

export const toGroupActivity = (row: GroupActivityRow): GroupActivity => ({
  id: row.id,
  action: row.action,
  metadata: row.metadata,
  actorName: toPersonName(row.actor_first_name, row.actor_last_name),
  createdAt: toIso(row.created_at),
});
