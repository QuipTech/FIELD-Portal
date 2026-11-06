import { MachineAccessMode } from '../access/machineScope';

export const ASSIGNMENT_TARGET_TYPES = ['organisation', 'user'] as const;
export type AssignmentTargetType = (typeof ASSIGNMENT_TARGET_TYPES)[number];

export const SHARE_ACCESS_LEVELS = ['view', 'contribute'] as const;
export type ShareAccessLevel = (typeof SHARE_ACCESS_LEVELS)[number];

// Rows read by the machineSharing repositories. Counts are cast to int in
// SQL (count(*) arrives from pg as a string).
export interface MachineGroupRow {
  id: string;
  name: string;
  colour: string | null;
  description: string | null;
  machine_count: number;
  organisation_count: number;
  user_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface MachineGroup {
  id: string;
  name: string;
  // #RRGGBB, or null for the default.
  colour: string | null;
  description: string | null;
  // Live machines in the group, from any organisation.
  machineCount: number;
  // Active assignments to organisations and to individual people.
  organisationCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MachineGroupRef {
  id: string;
  name: string;
  colour: string | null;
}

// A group the signed-in person can see machines through (GET /auth/me).
export interface AccessibleGroup extends MachineGroupRef {
  accessLevel: ShareAccessLevel;
}

// A person's machine access, as /admin/users, /team and /auth/me return it.
export interface MachineAccess {
  // What is stored; organisation admins always see their organisation's
  // machines, so effectiveMode says what actually applies.
  machineAccessMode: MachineAccessMode;
  effectiveMode: MachineAccessMode;
  // Groups assigned to them directly or through their organisation.
  groups: AccessibleGroup[];
}

// A machine in a group, as the platform administrator sees it.
export interface GroupMachine {
  id: string;
  // Plant ID, else fleet number, else serial.
  label: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  status: string;
  lifecycleState: string;
  owningOrganisation: { id: string; name: string };
  addedAt: string;
}

// A machine found by GET /admin/machines/search.
export type PlatformMachine = Omit<GroupMachine, 'addedAt'> & {
  registrationNumber: string | null;
};

export interface GroupAssignment {
  id: string;
  targetType: AssignmentTargetType;
  targetId: string;
  // The organisation's name, or the person's.
  targetName: string;
  targetEmail: string | null;
  // The organisation itself, or the person's.
  organisation: { id: string; name: string };
  accessLevel: ShareAccessLevel;
  grantedByName: string | null;
  grantedAt: string;
}

export interface GroupActivity {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  actorName: string | null;
  createdAt: string;
}

// One assignment that lets someone see an organisation's own machine
// (GET /machines/:machineId/shares). withdrawnAt is set once the owner
// withdrew this machine from it.
export interface MachineShare {
  assignmentId: string;
  group: MachineGroupRef;
  targetType: AssignmentTargetType;
  targetName: string;
  organisationName: string;
  accessLevel: ShareAccessLevel;
  grantedAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
}
