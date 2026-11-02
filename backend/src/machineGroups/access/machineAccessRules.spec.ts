import { BadRequestException } from '@nestjs/common';
import {
  ADMIN_ALL_MACHINES_MESSAGE,
  GROUPS_REQUIRED_MESSAGE,
  UNKNOWN_GROUP_MESSAGE,
  assertGroupsFound,
  toMachineAccessChange,
} from './machineAccessRules';

describe('toMachineAccessChange', () => {
  it("keeps no groups for 'all', whatever was sent", () => {
    expect(
      toMachineAccessChange({
        mode: 'all',
        groupIds: ['g1'],
        targetIsAdmin: false,
      }),
    ).toEqual({ mode: 'all', groupIds: [] });
  });

  it("lets an admin be set to 'all'", () => {
    expect(toMachineAccessChange({ mode: 'all', targetIsAdmin: true })).toEqual(
      { mode: 'all', groupIds: [] },
    );
  });

  it("needs at least one group for 'selected'", () => {
    expect(() =>
      toMachineAccessChange({
        mode: 'selected',
        groupIds: [],
        targetIsAdmin: false,
      }),
    ).toThrow(new BadRequestException(GROUPS_REQUIRED_MESSAGE));
    expect(() =>
      toMachineAccessChange({ mode: 'selected', targetIsAdmin: false }),
    ).toThrow(GROUPS_REQUIRED_MESSAGE);
  });

  it("refuses 'selected' for an organisation admin", () => {
    expect(() =>
      toMachineAccessChange({
        mode: 'selected',
        groupIds: ['g1'],
        targetIsAdmin: true,
      }),
    ).toThrow(ADMIN_ALL_MACHINES_MESSAGE);
  });

  it('drops duplicate groups', () => {
    expect(
      toMachineAccessChange({
        mode: 'selected',
        groupIds: ['g1', 'g2', 'g1'],
        targetIsAdmin: false,
      }),
    ).toEqual({ mode: 'selected', groupIds: ['g1', 'g2'] });
  });
});

describe('assertGroupsFound', () => {
  it('passes when every group was found', () => {
    expect(() => assertGroupsFound(['g1', 'g2'], ['g2', 'g1'])).not.toThrow();
  });

  it("refuses a group that isn't the organisation's", () => {
    expect(() => assertGroupsFound(['g1', 'other'], ['g1'])).toThrow(
      UNKNOWN_GROUP_MESSAGE,
    );
  });
});
