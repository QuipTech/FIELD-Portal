import { BadRequestException } from '@nestjs/common';
import { MachineAccessMode } from './machineScope';

export const GROUPS_REQUIRED_MESSAGE =
  'Choose at least one machine group, or give access to all machines.';
export const ADMIN_ALL_MACHINES_MESSAGE =
  "Organisation admins always see all machines, so they can't be limited to groups.";
export const UNKNOWN_GROUP_MESSAGE =
  "One or more of those machine groups don't exist in this organisation.";

export interface MachineAccessChange {
  mode: MachineAccessMode;
  groupIds: string[];
}

// What a person's machine access is set to, checked before anything is
// saved (no I/O, unit-tested):
//   * 'selected' needs at least one group
//   * an organisation admin can't be limited to groups
//   * 'all' keeps no groups, whatever was sent
export const toMachineAccessChange = (input: {
  mode: MachineAccessMode;
  groupIds?: string[];
  targetIsAdmin: boolean;
}): MachineAccessChange => {
  if (input.mode === 'all') return { mode: 'all', groupIds: [] };
  if (input.targetIsAdmin) {
    throw new BadRequestException(ADMIN_ALL_MACHINES_MESSAGE);
  }
  const groupIds = Array.from(new Set(input.groupIds ?? []));
  if (!groupIds.length) throw new BadRequestException(GROUPS_REQUIRED_MESSAGE);
  return { mode: 'selected', groupIds };
};

// Every requested group must be a live group of the same organisation.
export const assertGroupsFound = (
  requested: string[],
  found: string[],
): void => {
  const foundIds = new Set(found);
  if (requested.some((id) => !foundIds.has(id))) {
    throw new BadRequestException(UNKNOWN_GROUP_MESSAGE);
  }
};
