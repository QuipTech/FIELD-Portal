import { UserMachineAccessRow } from './machineAccess.repository';
import {
  GroupUserRow,
  MachineAccess,
  MachineGroup,
  MachineGroupDetail,
  MachineGroupRow,
} from './types/machineGroupTypes';

const toPersonName = (firstName: string, lastName: string) =>
  `${firstName} ${lastName}`.trim();

export const toMachineGroup = (row: MachineGroupRow): MachineGroup => ({
  id: row.id,
  name: row.name,
  colour: row.colour,
  contactName: row.contact_name,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  notes: row.notes,
  machineCount: row.machine_count,
  userCount: row.user_count,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const toMachineGroupDetail = (
  row: MachineGroupRow,
  users: GroupUserRow[],
): MachineGroupDetail => ({
  ...toMachineGroup(row),
  users: users.map((user) => ({
    id: user.id,
    name: toPersonName(user.first_name, user.last_name),
    email: user.email,
    status: user.status,
  })),
});

// Admins see every machine whatever is stored, and 'all' keeps no groups
// in the answer even if rows linger.
export const toMachineAccess = (row: UserMachineAccessRow): MachineAccess => {
  const effectiveMode = row.is_admin ? 'all' : row.machine_access_mode;
  return {
    machineAccessMode: row.machine_access_mode,
    effectiveMode,
    groups: effectiveMode === 'selected' ? row.groups : [],
  };
};

// For the audit log: what someone's access was or became.
export const toAccessSnapshot = (access: MachineAccess) => ({
  machineAccessMode: access.machineAccessMode,
  groups: access.groups.map((group) => ({ id: group.id, name: group.name })),
});
