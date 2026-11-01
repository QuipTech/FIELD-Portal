import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MachineScope } from './machineScope';

export const GROUP_REQUIRED_FOR_NEW_MACHINE_MESSAGE =
  "Choose one of your machine groups for this machine, or you won't be able to see it.";
export const NOT_YOUR_GROUP_MESSAGE = "That machine group isn't one of yours.";
export const ADMIN_ONLY_GROUPING_MESSAGE =
  'Only an organisation admin can put machines in groups.';

// The group a newly registered (or imported) machine goes in, checked
// before it's saved (no I/O, unit-tested):
//   * organisation admins may pick any group, or none
//   * people limited to groups must pick one of theirs, or the machine
//     would vanish for them as soon as it's saved
//   * everyone else registers ungrouped machines
// Whether a chosen group exists in the organisation is checked after.
export const resolveNewMachineGroup = (input: {
  scope: MachineScope;
  isAdmin: boolean;
  groupId: string | null;
}): string | null => {
  const { scope, groupId } = input;
  if (scope.kind === 'groups') {
    if (!groupId) {
      throw new BadRequestException(GROUP_REQUIRED_FOR_NEW_MACHINE_MESSAGE);
    }
    if (!scope.groupIds.includes(groupId)) {
      throw new BadRequestException(NOT_YOUR_GROUP_MESSAGE);
    }
    return groupId;
  }
  if (groupId && !input.isAdmin) {
    throw new ForbiddenException(ADMIN_ONLY_GROUPING_MESSAGE);
  }
  return groupId;
};
