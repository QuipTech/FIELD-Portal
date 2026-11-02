import { MachineAccessMode } from '../access/machineScope';

// Rows read by the machineGroups repositories. count(*) arrives from pg as
// a string, so counts are cast to int in SQL.
export interface MachineGroupRow {
  id: string;
  name: string;
  colour: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  machine_count: number;
  user_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface GroupUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

export interface GroupRefRow {
  id: string;
  name: string;
  colour: string | null;
}

export interface MovedMachineRow {
  id: string;
  label: string;
  group_id: string | null;
  group_name: string | null;
}

export interface MachineGroup {
  id: string;
  name: string;
  // #RRGGBB, or null for the default.
  colour: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  // Live machines in the group.
  machineCount: number;
  // People limited to selected groups who have this one. People who see
  // every machine aren't counted.
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MachineGroupDetail extends MachineGroup {
  // The people counted in userCount.
  users: { id: string; name: string; email: string; status: string }[];
}

export interface MachineGroupRef {
  id: string;
  name: string;
  colour: string | null;
}

// A person's machine access, as /team and /auth/me return it.
export interface MachineAccess {
  // What is stored; organisation admins always see every machine, so
  // effectiveMode says what actually applies.
  machineAccessMode: MachineAccessMode;
  effectiveMode: MachineAccessMode;
  // Their selected groups ('selected'); empty for 'all'.
  groups: MachineGroupRef[];
}
