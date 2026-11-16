// Global machine groups (backend src/machineSharing): the platform
// administrator's groups hold machines from any organisation and are shared
// with organisations or people at "view" or "contribute".

export type ShareAccessLevel = "view" | "contribute";
// "owner" for the caller's own organisation's machines.
export type MachineAccessLevel = "owner" | ShareAccessLevel;
export type AssignmentTargetType = "organisation" | "user";

// "all": own organisation's machines plus shared groups. "groups_only":
// only machines in groups assigned to them or their organisation.
// Organisation admins are always "all".
export type MachineAccessMode = "all" | "groups_only";

export interface MachineGroupRef {
  id: string;
  name: string;
  // #RRGGBB, or null for the default.
  colour: string | null;
}

// A group someone sees machines through (GET /auth/me).
export interface AccessibleGroup extends MachineGroupRef {
  accessLevel: ShareAccessLevel;
}

// A person's machine access (GET /admin/users, /team, …/machine-access).
export interface MachineAccess {
  // What is stored; effectiveMode is what applies ("all" for admins).
  machineAccessMode: MachineAccessMode;
  effectiveMode: MachineAccessMode;
  // Assigned to them directly or through their organisation.
  groups: AccessibleGroup[];
}

// GET /admin/machine-groups.
export interface MachineGroup extends MachineGroupRef {
  description: string | null;
  machineCount: number;
  organisationCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

// POST and PATCH /admin/machine-groups; null clears an optional field.
export interface MachineGroupChanges {
  name: string;
  colour: string | null;
  description: string | null;
}

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

// GET /admin/machines/search.
export type PlatformMachine = Omit<GroupMachine, "addedAt"> & { registrationNumber: string | null };

// GET and PUT /admin/machines/:machineId/groups.
export interface MachineGroupMembership {
  id: string;
  name: string;
}

export interface GroupAssignment {
  id: string;
  targetType: AssignmentTargetType;
  targetId: string;
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

// GET /machines/:machineId/shares (the owning organisation's admins).
export interface MachineShare {
  assignmentId: string;
  group: MachineGroupRef;
  targetType: AssignmentTargetType;
  targetName: string;
  organisationName: string;
  accessLevel: ShareAccessLevel;
  grantedAt: string;
  // Set once the owner withdrew this machine from the share.
  withdrawnAt: string | null;
  withdrawnReason: string | null;
}

// What every machine read now says about sharing (list and detail).
export interface MachineSharing {
  groups: MachineGroupRef[];
  owningOrganisationName: string;
  isShared: boolean;
  accessLevel: MachineAccessLevel;
}
